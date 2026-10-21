import { type ProcessTurnPayload, QUEUES } from '@cobra/contracts'
import type { TurnOutcome } from './process-turn.job.js'

export interface FollowUp {
  queue: string
  payload: Record<string, unknown>
  options?: { singletonKey?: string; startAfter?: number }
}

/**
 * What the queue has to do once a turn returns.
 *
 * Pulled out of the worker registration so it can be tested without a running
 * pg-boss. It exists because the send was missing there and nothing failed: the
 * turn completed, the reply was stored `pending`, and the customer got nothing.
 */
export const followUpsFor = (payload: ProcessTurnPayload, outcome: TurnOutcome): FollowUp[] => {
  /**
   * The burst window, re-queued rather than slept through: holding the job open
   * would occupy a worker slot doing nothing, and `stately` would refuse the
   * next message's job behind it. The turn has not run, so there is nothing to
   * send yet.
   *
   * `windowStartedAt` is carried across re-queues so the hard cap is measured
   * from the first unread message and not from the last retry.
   */
  if (outcome.deferForMs) {
    return [
      {
        queue: QUEUES.processTurn,
        payload: {
          ...payload,
          windowStartedAt: payload.windowStartedAt ?? new Date().toISOString(),
        },
        options: {
          singletonKey: payload.conversationId,
          startAfter: Math.ceil(outcome.deferForMs / 1000),
        },
      },
    ]
  }

  /**
   * Sending is its own queue with its own retries. Re-running a whole turn
   * because one HTTP call failed is expensive and risks running its tools
   * twice; retrying the send costs nothing.
   */
  if (outcome.outboundMessageId) {
    return [
      {
        queue: QUEUES.sendMessage,
        payload: {
          tenantId: payload.tenantId,
          conversationId: payload.conversationId,
          messageId: outcome.outboundMessageId,
        },
      },
    ]
  }

  return []
}
