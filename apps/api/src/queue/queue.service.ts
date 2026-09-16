import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import PgBoss from 'pg-boss'
import {
  type ProcessReceiptJob,
  type ProcessTurnJob,
  QUEUES,
  type SendMessageJob,
} from '@cobra/contracts'

/**
 * The API's side of the queue: it enqueues and nothing else.
 *
 * `supervise`, `schedule` and `migrate` are all off. pg-boss runs its
 * maintenance — supervise, schedule, vacuum, reindex — per instance, so leaving
 * them on in every replica of the API multiplies that work against one database.
 * The worker is the single instance that owns it, and it is also the one that
 * creates the queues.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnApplicationShutdown {
  private readonly boss: PgBoss

  constructor(config: ConfigService) {
    this.boss = new PgBoss({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
      supervise: false,
      schedule: false,
      migrate: false,
    })
  }

  async onModuleInit(): Promise<void> {
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
  enqueueTurn(job: ProcessTurnJob): Promise<string | null> {
    return this.boss.send(QUEUES.processTurn, job, { singletonKey: job.conversationId })
  }

  enqueueSend(job: SendMessageJob): Promise<string | null> {
    return this.boss.send(QUEUES.sendMessage, job)
  }

  /**
   * Enqueued the moment an image lands, with no window in front of it: reading
   * a receipt with Gemini takes seconds, and those run alongside the text burst
   * window rather than after it.
   */
  enqueueReceipt(job: ProcessReceiptJob): Promise<string | null> {
    return this.boss.send(QUEUES.processReceipt, job)
  }
}
