import { Injectable, Logger } from '@nestjs/common'
import { ConversationRepository } from '../repositories/conversation.repository.js'

/**
 * How long a conversation has to be silent before the agent forgets it.
 *
 * A customer who wrote, left the conversation unanswered and came back four
 * days later was answered with the memory of the old exchange. The schedule
 * runs at midnight, so the cut lands between 48 and 72 hours after the last
 * message, never before 48.
 */
export const STALE_CONTEXT_IDLE = '48 hours'

export interface ResetStaleContextsPayload {
  tenantId: string
}

/**
 * One tenant's nightly reset. Its own job, so a tenant whose reset fails is
 * retried and shows up on the platform without holding back anyone else's.
 */
@Injectable()
export class ResetStaleContextsJobHandler {
  private readonly logger = new Logger(ResetStaleContextsJobHandler.name)

  constructor(private readonly conversations: ConversationRepository) {}

  async run(payload: ResetStaleContextsPayload): Promise<{ reset: number }> {
    const reset = await this.conversations.resetStaleContexts(payload.tenantId, STALE_CONTEXT_IDLE)

    if (reset) {
      this.logger.log(
        `Agent memory started over in ${reset} silent conversations of ${payload.tenantId}`,
      )
    }

    return { reset }
  }
}
