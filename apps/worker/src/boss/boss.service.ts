import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import PgBoss from 'pg-boss'
import {
  type NotifyTenantAdminPayload,
  type ProcessReceiptPayload,
  type ProcessTurnPayload,
  QUEUES,
  type SendMessagePayload,
  TURN_QUEUE_OPTIONS,
} from '@cobra/contracts'
import { NotifyTenantAdminJobHandler } from '../jobs/notify-tenant-admin.job.js'
import { ProcessReceiptJobHandler } from '../jobs/process-receipt.job.js'
import { ProcessTurnJobHandler } from '../jobs/process-turn.job.js'
import { SendMessageJobHandler } from '../jobs/send-message.job.js'
import { followUpsFor } from '../jobs/turn-follow-ups.js'
import { JobRunRepository } from '../repositories/job-run.repository.js'

const RECEIPT_QUEUE_OPTIONS = {
  retryLimit: 2,
  retryDelaySeconds: 5,
  expireInSeconds: 180,
  batchSize: 2,
} as const

// Retries with growing waits: the failure this exists for is Meta answering
// `(#131000) Something went wrong`, which passes on its own.
const SEND_QUEUE_OPTIONS = {
  retryLimit: 5,
  retryDelaySeconds: 10,
  expireInSeconds: 120,
  batchSize: 5,
} as const

// No retries: an alert whose 24-hour window has closed will never get
// through, and retrying it is a loop with no exit.
const TENANT_ADMIN_ALERT_QUEUE_OPTIONS = {
  retryLimit: 0,
  expireInSeconds: 60,
  batchSize: 5,
} as const

/**
 * The worker owns pg-boss: it migrates the schema, supervises, and works the
 * four queues. The API only enqueues — maintenance runs per instance, and having
 * it in every API replica multiplies that work against one database.
 */
@Injectable()
export class BossService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(BossService.name)
  private readonly boss: PgBoss

  constructor(
    private readonly config: ConfigService,
    private readonly processTurnHandler: ProcessTurnJobHandler,
    private readonly processReceiptHandler: ProcessReceiptJobHandler,
    private readonly sendMessageHandler: SendMessageJobHandler,
    private readonly notifyTenantAdminHandler: NotifyTenantAdminJobHandler,
    private readonly jobRuns: JobRunRepository,
  ) {
    this.boss = new PgBoss({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      migrate: true,
    })
  }

  async onModuleInit(): Promise<void> {
    this.boss.on('error', (error) => this.logger.error(`pg-boss: ${error.message}`))

    await this.boss.start()
    await this.createQueues()
    await this.registerWorkers()

    this.logger.log('Cobra worker is listening on its four queues')
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss.stop({ graceful: true })
  }

  private async createQueues(): Promise<void> {
    /**
     * `stately` is the whole debounce.
     *
     * It keeps one job active and at most one queued behind it per
     * `singletonKey`, which is exactly what a burst needs. `singletonKey` on its
     * own deduplicates nothing — and that is a silent failure: without the
     * policy, N turns run concurrently against the same model and the same
     * tools, with no error anywhere.
     *
     * The two overrides matter as much. `retryLimit` defaults to 2, so a turn
     * that crashes after sending the WhatsApp message answers the customer
     * twice; sending has its own queue with its own retries, so the turn needs
     * none. `expireInSeconds` defaults to 15 minutes, so a dead worker would
     * freeze that conversation for a quarter of an hour.
     */
    await this.boss.createQueue(QUEUES.processTurn, {
      policy: 'stately',
      retryLimit: TURN_QUEUE_OPTIONS.retryLimit,
      expireInSeconds: TURN_QUEUE_OPTIONS.expireInSeconds,
    })

    await this.boss.createQueue(QUEUES.processReceipt, {
      policy: 'standard',
      retryLimit: RECEIPT_QUEUE_OPTIONS.retryLimit,
      retryDelay: RECEIPT_QUEUE_OPTIONS.retryDelaySeconds,
      expireInSeconds: RECEIPT_QUEUE_OPTIONS.expireInSeconds,
    })

    await this.boss.createQueue(QUEUES.sendMessage, {
      policy: 'standard',
      retryLimit: SEND_QUEUE_OPTIONS.retryLimit,
      retryDelay: SEND_QUEUE_OPTIONS.retryDelaySeconds,
      retryBackoff: true,
      expireInSeconds: SEND_QUEUE_OPTIONS.expireInSeconds,
    })

    await this.boss.createQueue(QUEUES.notifyTenantAdmin, {
      policy: 'standard',
      retryLimit: TENANT_ADMIN_ALERT_QUEUE_OPTIONS.retryLimit,
      expireInSeconds: TENANT_ADMIN_ALERT_QUEUE_OPTIONS.expireInSeconds,
    })
  }

  private async registerWorkers(): Promise<void> {
    const concurrency = this.config.getOrThrow<number>('TURN_CONCURRENCY')

    await this.boss.work<ProcessTurnPayload>(
      QUEUES.processTurn,
      { batchSize: concurrency, includeMetadata: true },
      async (jobs) => {
        for (const job of jobs) {
          await this.recordAttempt(job, async () => {
            const outcome = await this.processTurnHandler.run(job.data)

            for (const followUp of followUpsFor(job.data, outcome)) {
              await this.boss.send(followUp.queue, followUp.payload, followUp.options ?? {})
            }

            return outcome.error ?? null
          })
        }
      },
    )

    await this.boss.work<ProcessReceiptPayload>(
      QUEUES.processReceipt,
      { batchSize: RECEIPT_QUEUE_OPTIONS.batchSize, includeMetadata: true },
      async (jobs) => {
        for (const job of jobs) {
          await this.recordAttempt(job, async () => {
            await this.processReceiptHandler.run(job.data)
          })
        }
      },
    )

    await this.boss.work<SendMessagePayload>(
      QUEUES.sendMessage,
      { batchSize: SEND_QUEUE_OPTIONS.batchSize, includeMetadata: true },
      async (jobs) => {
        for (const job of jobs) {
          await this.recordAttempt(job, async () => {
            await this.sendMessageHandler.run(job.data)
          })
        }
      },
    )

    await this.boss.work<NotifyTenantAdminPayload>(
      QUEUES.notifyTenantAdmin,
      { batchSize: TENANT_ADMIN_ALERT_QUEUE_OPTIONS.batchSize, includeMetadata: true },
      async (jobs) => {
        for (const job of jobs) {
          await this.recordAttempt(job, async () => {
            await this.notifyTenantAdminHandler.run(job.data)
          })
        }
      },
    )
  }

  /**
   * Every queue goes through here, so a new one cannot be added without its
   * attempts showing up on the platform.
   *
   * `retryCount` is how many attempts came before this one: pg-boss bumps it
   * when it hands the job out again, not when it fails.
   *
   * `work` may resolve to an error message: a job that failed without
   * throwing, because what it does next still has to happen.
   */
  private async recordAttempt(
    job: PgBoss.JobWithMetadata<{ tenantId: string; conversationId?: string }>,
    work: () => Promise<string | null | void>,
  ): Promise<void> {
    const { tenantId, conversationId } = job.data

    const runId = await this.jobRuns.start(tenantId, {
      conversationId: conversationId ?? null,
      queue: job.name,
      jobId: job.id,
      attempt: job.retryCount + 1,
      maxAttempts: job.retryLimit + 1,
    })

    let handledError: string | null | void

    try {
      handledError = await work()
    } catch (caught) {
      await this.jobRuns.finish(tenantId, runId, caught)
      throw caught
    }

    await this.jobRuns.finish(tenantId, runId, handledError ?? undefined)
  }
}
