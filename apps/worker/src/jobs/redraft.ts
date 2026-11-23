import { TURN_HARD_CAP_MS } from '@cobra/contracts'

/** The tools that only read. Anything else changed something outside the conversation. */
const READ_ONLY_TOOLS = new Set(['LookupCustomer', 'CheckPendingReceipt'])

export interface RedraftInput {
  /** Inbound messages that arrived while the turn ran and that it never saw. */
  lateMessageCount: number
  calledTools: readonly string[]
  error: string | null
  /** When the oldest message this turn was answering arrived. */
  oldestUnansweredAt: Date
  now?: Date
}

/**
 * Whether a finished turn's reply is thrown away so the next turn answers
 * everything at once.
 *
 * Steering only looks for new messages before a tool runs. A message that
 * arrives while the model is writing its last words is never seen, and the
 * customer gets two replies a few seconds apart, the second one repeating the
 * first: on 2026-11-16 a customer who wrote twice, ten seconds apart, about a
 * balance in their favour got two near-identical balance summaries.
 *
 * Only a turn that read and nothing else can be redone: one that registered a
 * payment, credited a balance or alerted the administrator already acted, and
 * running it again would act twice. The hard cap keeps a customer who never
 * stops typing from waiting forever for an answer.
 */
export const shouldRedraftTurn = ({
  lateMessageCount,
  calledTools,
  error,
  oldestUnansweredAt,
  now = new Date(),
}: RedraftInput): boolean => {
  if (!lateMessageCount) return false

  if (error) return false

  if (calledTools.some((tool) => !READ_ONLY_TOOLS.has(tool))) return false

  return now.getTime() - oldestUnansweredAt.getTime() < TURN_HARD_CAP_MS
}
