import type { ConversationSummary } from '@cobra/contracts'

interface State {
  label: string
  /** The dot and the word share it; nothing else on the row is coloured. */
  tone: string
}

/**
 * One state per row, said once: a dot and a word in the same colour. A failed
 * turn outranks the status, because it is the one the operator has to act on —
 * the customer was left without an answer.
 */
export const stateOf = (conversation: ConversationSummary): State => {
  if (conversation.lastRunFailed) return { label: 'Con error', tone: 'text-destructive' }
  if (conversation.status === 'human') return { label: 'Asesor', tone: 'text-warning' }
  if (conversation.status === 'closed')
    return { label: 'Cerrada', tone: 'text-disabled-foreground' }

  return { label: 'Agente', tone: 'text-muted-foreground' }
}
