import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import PgBoss from 'pg-boss'
import {
  type NotifyAdminJob,
  type ProcessReceiptJob,
  type ProcessTurnJob,
  QUEUES,
  type SendMessageJob,
  TURN_QUEUE_OPTIONS,
} from '@cobra/contracts'
import { NotifyAdminJobHandler } from '../jobs/notify-admin.job.js'
import { ProcessReceiptJobHandler } from '../jobs/process-receipt.job.js'
import { ProcessTurnJobHandler } from '../jobs/process-turn.job.js'
import { SendMessageJobHandler } from '../jobs/send-message.job.js'

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
    private readonly turns: ProcessTurnJobHandler,
    private readonly receipts: ProcessReceiptJobHandler,
    private readonly sends: SendMessageJobHandler,
    private readonly alerts: NotifyAdminJobHandler,
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
      retryLimit: 2,
      retryDelay: 5,
      expireInSeconds: 180,
    })

    // Retries with growing waits: the failure this exists for is Meta answering
    // `(#131000) Something went wrong`, which passes on its own.
    await this.boss.createQueue(QUEUES.sendMessage, {
      policy: 'standard',
      retryLimit: 5,
      retryDelay: 10,
      retryBackoff: true,
      expireInSeconds: 120,
    })

    // No retries: an alert whose 24-hour window has closed will never get
    // through, and retrying it is a loop with no exit.
    await this.boss.createQueue(QUEUES.notifyAdmin, {
      policy: 'standard',
      retryLimit: 0,
      expireInSeconds: 60,
    })
  }

  private async registerWorkers(): Promise<void> {
    const concurrency = this.config.getOrThrow<number>('TURN_CONCURRENCY')

    await this.boss.work<ProcessTurnJob>(
      QUEUES.processTurn,
      { batchSize: concurrency },
      async (jobs) => {
        for (const job of jobs) {
          const outcome = await this.turns.handle(job.data)

          /**
           * The burst window, re-queued rather than slept through: holding the
           * job open would occupy a worker slot doing nothing, and `stately`
           * would refuse the next message's job behind it.
           */
          if (outcome.retryInMs) {
            await this.boss.send(QUEUES.processTurn, withWindow(job.data), {
              singletonKey: job.data.conversationId,
              startAfter: Math.ceil(outcome.retryInMs / 1000),
            })
          }
        }
      },
    )

    await this.boss.work<ProcessReceiptJob>(
      QUEUES.processReceipt,
      { batchSize: 2 },
      async (jobs) => {
        for (const job of jobs) await this.receipts.handle(job.data)
      },
    )

    await this.boss.work<SendMessageJob>(QUEUES.sendMessage, { batchSize: 5 }, async (jobs) => {
      for (const job of jobs) await this.sends.handle(job.data)
    })

    await this.boss.work<NotifyAdminJob>(QUEUES.notifyAdmin, { batchSize: 5 }, async (jobs) => {
      for (const job of jobs) await this.alerts.handle(job.data)
    })
  }
}

/**
 * Carries the moment the window opened across re-queues, so the hard cap is
 * measured from the first unread message and not from the last retry.
 */
const withWindow = (job: ProcessTurnJob): ProcessTurnJob => ({
  ...job,
  windowStartedAt: job.windowStartedAt ?? new Date().toISOString(),
})
