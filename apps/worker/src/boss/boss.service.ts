import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import PgBoss from 'pg-boss'
import {
  type ApplyHeldReceiptPayload,
  type NotifyTenantAdminPayload,
  type ProcessReceiptPayload,
  type ProcessTurnPayload,
  QUEUES,
  type SendMessagePayload,
  TURN_QUEUE_OPTIONS,
} from '@cobra/contracts'
import { ApplyHeldReceiptJobHandler } from '../jobs/apply-held-receipt.job.js'
import { NotifyTenantAdminJobHandler } from '../jobs/notify-tenant-admin.job.js'
import { ProcessReceiptJobHandler } from '../jobs/process-receipt.job.js'
import { ProcessTurnJobHandler } from '../jobs/process-turn.job.js'
import {
  ResetStaleContextsJobHandler,
  type ResetStaleContextsPayload,
} from '../jobs/reset-stale-contexts.job.js'
import { SendMessageJobHandler } from '../jobs/send-message.job.js'
import { followUpsFor } from '../jobs/turn-follow-ups.js'
import { JobRunRepository } from '../repositories/job-run.repository.js'
import { TenantRepository } from '../repositories/tenant.repository.js'

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
 * The agent's memory of a silent conversation starts over at midnight, Bogotá
 * time, where every tenant operates today.
 *
 * Both queues poll once a minute: they run once a night, and polling every two
 * seconds like the others would take connections from the queues that answer
 * customers. Retrying is safe because the reset is idempotent.
 */
const CONTEXT_RESET_SCHEDULE = { cron: '0 0 * * *', tz: 'America/Bogota' } as const

const CONTEXT_RESET_QUEUE_OPTIONS = {
  retryLimit: 2,
  retryDelaySeconds: 60,
  expireInSeconds: 120,
  batchSize: 5,
  pollingIntervalSeconds: 60,
} as const

/**
 * The worker owns pg-boss: it migrates the schema, supervises, and works the
 * queues. The API only enqueues — maintenance runs per instance, and having
 * it in every API replica multiplies that work against one database.
 *
 * `max` caps the connections this process holds: one per queue, since each
 * polls every two seconds and keeps its connection warm, plus two for the
 * follow-up sends and maintenance. Left at pg's default of 10, the worker and
 * the API could ask for 20 between them, and on 2026-10-28 the dev pooler,
 * which allows 15, refused one and took the API down.
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
    private readonly resetStaleContextsHandler: ResetStaleContextsJobHandler,
    private readonly applyHeldReceiptHandler: ApplyHeldReceiptJobHandler,
    private readonly tenants: TenantRepository,
    private readonly jobRuns: JobRunRepository,
  ) {
    this.boss = new PgBoss({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: 7,
      migrate: true,
    })
  }

  async onModuleInit(): Promise<void> {
    this.boss.on('error', (error) => this.logger.error(`pg-boss: ${error.message}`))

    await this.boss.start()
    await this.createQueues()
    await this.registerWorkers()

    this.logger.log('Cobra worker is listening on its queues')
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

    const contextResetQueueOptions = {
      policy: 'standard',
      retryLimit: CONTEXT_RESET_QUEUE_OPTIONS.retryLimit,
      retryDelay: CONTEXT_RESET_QUEUE_OPTIONS.retryDelaySeconds,
      expireInSeconds: CONTEXT_RESET_QUEUE_OPTIONS.expireInSeconds,
    } as const

    await this.boss.createQueue(QUEUES.dispatchContextResets, contextResetQueueOptions)
    await this.boss.createQueue(QUEUES.resetStaleContexts, contextResetQueueOptions)

    /**
     * `singleton` keeps one job per receipt, so a double submit that slipped past
     * the API's `applying` guard is still one payment. No retries: a retry after
     * Wisphub registered the money is the double charge this job guards against;
     * a failure lands back in "Pendientes" with its reason instead.
     */
    await this.boss.createQueue(QUEUES.applyHeldReceipt, {
      policy: 'singleton',
      retryLimit: 0,
      expireInSeconds: 120,
    })

    // Idempotent: it replaces the schedule this queue already had, so a restart
    // or a second worker does not add another one.
    await this.boss.schedule(QUEUES.dispatchContextResets, CONTEXT_RESET_SCHEDULE.cron, undefined, {
      tz: CONTEXT_RESET_SCHEDULE.tz,
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

    await this.boss.work<ApplyHeldReceiptPayload>(
      QUEUES.applyHeldReceipt,
      { includeMetadata: true },
      async (jobs) => {
        for (const job of jobs) {
          await this.recordAttempt(job, async () => {
            const outcome = await this.applyHeldReceiptHandler.run(job.data)

            // The confirmation goes out through the send queue and its retries,
            // like every other message.
            if (outcome.confirmation) {
              const send: SendMessagePayload = {
                tenantId: job.data.tenantId,
                ...outcome.confirmation,
              }
              await this.boss.send(QUEUES.sendMessage, send)
            }
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

    // Not recorded: `job_runs` rows belong to a tenant and this job has none.
    // A failure here reaches the log, and pg-boss retries the whole fan-out.
    await this.boss.work(
      QUEUES.dispatchContextResets,
      { pollingIntervalSeconds: CONTEXT_RESET_QUEUE_OPTIONS.pollingIntervalSeconds },
      async () => {
        const tenantIds = await this.tenants.listIds()

        for (const tenantId of tenantIds) {
          const payload: ResetStaleContextsPayload = { tenantId }
          await this.boss.send(QUEUES.resetStaleContexts, payload)
        }
      },
    )

    await this.boss.work<ResetStaleContextsPayload>(
      QUEUES.resetStaleContexts,
      {
        batchSize: CONTEXT_RESET_QUEUE_OPTIONS.batchSize,
        pollingIntervalSeconds: CONTEXT_RESET_QUEUE_OPTIONS.pollingIntervalSeconds,
        includeMetadata: true,
      },
      async (jobs) => {
        for (const job of jobs) {
          await this.recordAttempt(job, async () => {
            await this.resetStaleContextsHandler.run(job.data)
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
