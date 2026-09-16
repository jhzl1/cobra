import { z } from 'zod'
// Side effect: zod answers in Spanish. Imported per module, not only from
// index, so importing this file directly cannot skip it.
import './locale'

/**
 * The four queues, named once. `apps/api` only ever enqueues; `apps/worker`
 * creates them and works them.
 */
export const QUEUES = {
  /**
   * Drains a conversation's unprocessed inbound messages into one turn.
   *
   * The job carries no message: it is a drain, not a load. Whatever arrived
   * while it waited is picked up by the same run.
   */
  processTurn: 'process-turn',
  /**
   * Downloads, reads and validates a receipt. Enqueued the moment the image
   * lands, so Gemini runs while the text burst window is still open instead of
   * after it.
   */
  processReceipt: 'process-receipt',
  /**
   * Sending is its own job with its own retries.
   *
   * n8n execution 40057: the whole turn succeeded and only the POST to WhatsApp
   * failed, with `(#131000) Something went wrong`. The customer had sent a
   * receipt for $50.000 and never got the question about their document.
   * Retrying a turn is expensive and risky; retrying a send is free.
   */
  sendMessage: 'send-message',
  /** Alerts to the administrator. Best-effort by contract, never in a turn's path. */
  notifyAdmin: 'notify-admin',
} as const

export const processTurnJobSchema = z.object({
  tenantId: z.uuid(),
  conversationId: z.uuid(),
  trigger: z.enum(['inbound', 'manual_replay']).default('inbound'),
  /**
   * When the debounce re-queues itself, this carries the first unprocessed
   * message's time so the hard cap is measured from it and not from the retry.
   */
  windowStartedAt: z.string().optional(),
})

export type ProcessTurnJob = z.infer<typeof processTurnJobSchema>

export const processReceiptJobSchema = z.object({
  tenantId: z.uuid(),
  conversationId: z.uuid(),
  messageId: z.uuid(),
  mediaId: z.string(),
})

export type ProcessReceiptJob = z.infer<typeof processReceiptJobSchema>

export const sendMessageJobSchema = z.object({
  tenantId: z.uuid(),
  conversationId: z.uuid(),
  messageId: z.uuid(),
})

export type SendMessageJob = z.infer<typeof sendMessageJobSchema>

export const notifyAdminJobSchema = z.object({
  tenantId: z.uuid(),
  conversationId: z.uuid().optional(),
  text: z.string(),
  mediaId: z.string().nullable().optional(),
})

export type NotifyAdminJob = z.infer<typeof notifyAdminJobSchema>

/**
 * pg-boss defaults that would misbehave here, overridden once.
 *
 * `retryLimit` defaults to 2: a turn that crashes after sending the WhatsApp
 * message answers the customer twice. `expireInSeconds` defaults to 15 minutes:
 * a dead worker freezes that conversation for a quarter of an hour.
 */
export const TURN_QUEUE_OPTIONS = {
  retryLimit: 0,
  expireInSeconds: 120,
} as const

/** The burst window for text. Media never waits. */
export const TEXT_BURST_WINDOW_MS = 1_500
/** Nobody defers a turn forever by typing without stopping. */
export const TURN_HARD_CAP_MS = 25_000
