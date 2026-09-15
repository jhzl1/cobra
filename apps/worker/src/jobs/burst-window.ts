import type { ConversationMessage } from '@cobra/agent'
import { TEXT_BURST_WINDOW_MS, TURN_HARD_CAP_MS } from '@cobra/contracts'

/**
 * How long this turn should still wait before running, in milliseconds. Zero
 * means run now.
 *
 * Three rules, and each one is a decision from PLAN.md:
 *
 *  - text waits 1,5 seconds after the last message, so three lines in a row
 *    become one turn. n8n waited five, which was latency given away: the
 *    customer sees no silence because the read receipt and the typing indicator
 *    go out as soon as the message lands.
 *  - an image never waits. Downloading it and reading it with Gemini takes
 *    several seconds, and those run alongside the text window instead of after
 *    it.
 *  - the hard cap stops someone typing without pause from deferring their own
 *    answer forever, and it is measured from the first unread message — which is
 *    why the window's start travels across re-queues.
 */
export const burstWait = (
  messages: readonly ConversationMessage[],
  now: Date = new Date(),
  windowStartedAt?: string,
): number => {
  if (!messages.length) return 0
  if (messages.some((message) => message.mediaId)) return 0

  const nowMs = now.getTime()
  const newest = Math.max(...messages.map((message) => message.receivedAt.getTime()))
  const oldest = windowStartedAt
    ? new Date(windowStartedAt).getTime()
    : Math.min(...messages.map((message) => message.receivedAt.getTime()))

  if (nowMs - oldest >= TURN_HARD_CAP_MS) return 0

  const remaining = TEXT_BURST_WINDOW_MS - (nowMs - newest)

  return remaining > 0 ? remaining : 0
}
