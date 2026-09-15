import type { MetaMessage } from '@cobra/contracts'

/** Only what the agent knows how to read. Everything else is discarded. */
export const SUPPORTED_TYPES = new Set(['text', 'image'])

/**
 * One hour, measured against Meta's own `messages[].timestamp` and not against
 * arrival.
 *
 * The difference is the outage case: the webhook was down for six days in July,
 * Meta retried with backoff the whole time, and when it came back it delivered
 * the entire backlog at once. Measured on arrival every one of those looked
 * fresh, and sixteen credits were applied for payments already long settled.
 */
export const MAX_MESSAGE_AGE_MS = 60 * 60 * 1000

export const isSupportedType = (message: MetaMessage): boolean =>
  SUPPORTED_TYPES.has(message.type)

export const isFresh = (message: MetaMessage, now: Date = new Date()): boolean => {
  const seconds = Number(message.timestamp)

  if (!Number.isFinite(seconds)) return false

  return now.getTime() - seconds * 1000 <= MAX_MESSAGE_AGE_MS
}
