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

/**
 * How long a conversation held by a person can go without an operator writing
 * in it before the agent takes it back. With the midnight schedule the agent
 * returns between 24 and 48 hours after the handoff or the operator's last
 * message, never before 24.
 */
export const IDLE_HANDOFF = '24 hours'

export interface ResetStaleContextsPayload {
  tenantId: string
}

/**
 * One tenant's nightly maintenance: the agent's memory of silent conversations,
 * and the conversations a person took and left. Its own job per tenant, so one
 * that fails is retried and shows up on the platform without holding back
 * anyone else's.
 */
@Injectable()
export class ResetStaleContextsJobHandler {
  private readonly logger = new Logger(ResetStaleContextsJobHandler.name)

  constructor(private readonly conversations: ConversationRepository) {}

  async run(payload: ResetStaleContextsPayload): Promise<{ reset: number; released: number }> {
    const reset = await this.conversations.resetStaleContexts(payload.tenantId, STALE_CONTEXT_IDLE)

    if (reset) {
      this.logger.log(
        `Agent memory started over in ${reset} silent conversations of ${payload.tenantId}`,
      )
    }

    const released = await this.conversations.releaseIdleHandoffs(payload.tenantId, IDLE_HANDOFF)

    if (released) {
      this.logger.log(
        `The agent took back ${released} conversations of ${payload.tenantId} nobody answered`,
      )
    }

    return { reset, released }
  }
}
