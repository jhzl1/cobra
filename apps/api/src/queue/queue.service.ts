import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import PgBoss from 'pg-boss'
import {
  type ProcessReceiptPayload,
  type ProcessTurnPayload,
  QUEUES,
  type SendMessagePayload,
} from '@cobra/contracts'

/**
 * The API's side of the queue: it enqueues and nothing else.
 *
 * `supervise`, `schedule` and `migrate` are all off. pg-boss runs its
 * maintenance — supervise, schedule, vacuum, reindex — per instance, so leaving
 * them on in every replica of the API multiplies that work against one database.
 * The worker is the single instance that owns it, and it is also the one that
 * creates the queues.
 *
 * `max` caps the connections this process holds. Left at pg's default of 10,
 * the API and the worker could ask for 20 between them, and on 2026-10-28 the
 * dev pooler, which allows 15, refused one. Enqueueing holds a connection
 * for milliseconds, so three is plenty: a burst waits its turn in the pool.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name)
  private readonly boss: PgBoss

  constructor(config: ConfigService) {
    this.boss = new PgBoss({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      max: 3,
      supervise: false,
      schedule: false,
      migrate: false,
    })
  }

  async onModuleInit(): Promise<void> {
    // pg-boss reports background failures as an `error` event, and Node kills a
    // process whose emitter has no listener for it. That is how one refused
    // connection took the dev API down on 2026-10-28: the queue cache refresh
    // failed and nothing was listening.
    this.boss.on('error', (error) => this.logger.error(`pg-boss: ${error.message}`))

    await this.boss.start()
  }

  async onApplicationShutdown(): Promise<void> {
    await this.boss.stop()
  }

  /**
   * One turn per conversation, with `singletonKey` so a burst collapses.
   *
   * The deduplication comes from the queue's `stately` policy, set by the
   * worker when it creates the queue — `singletonKey` alone does not deduplicate
   * anything. Getting that wrong fails silently: N concurrent turns against the
   * same model and the same tools, with no error anywhere.
   */
  enqueueTurn(job: ProcessTurnPayload): Promise<string | null> {
    return this.boss.send(QUEUES.processTurn, job, { singletonKey: job.conversationId })
  }

  enqueueSend(job: SendMessagePayload): Promise<string | null> {
    return this.boss.send(QUEUES.sendMessage, job)
  }

  /**
   * Enqueued the moment an image lands, with no window in front of it: reading
   * a receipt with Gemini takes seconds, and those run alongside the text burst
   * window rather than after it.
   */
  enqueueReceipt(job: ProcessReceiptPayload): Promise<string | null> {
    return this.boss.send(QUEUES.processReceipt, job)
  }
}
