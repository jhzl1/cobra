import type { ConversationSummary } from '@cobra/contracts'
import { formatPhone } from '~/utils/formatters'

interface RowState {
  /** The dot's colour, or null when there is nothing to attend to. */
  dotTone: string | null
  /** Who or what holds the conversation, said only when it is not the agent. */
  label: string | null
  labelTone: string
}

/**
 * The dot appears only when there is something to attend to, because in every
 * chat app a dot on a row means "look here". It used to sit on every row, grey
 * for "the agent has it", which is the normal case and nothing to look at — so
 * the dot meant nothing and read as unread.
 *
 * A failed turn outranks everything: the customer was left without an answer.
 * A person holding the conversation comes next, then unread messages.
 */
export const stateOf = (conversation: ConversationSummary, hasUnread: boolean): RowState => {
  if (conversation.lastRunFailed) {
    return { dotTone: 'text-destructive', label: 'Con error', labelTone: 'text-destructive' }
  }

  if (conversation.status === 'human') {
    return { dotTone: 'text-warning', label: 'Asesor', labelTone: 'text-warning' }
  }

  if (conversation.status === 'closed') {
    return { dotTone: null, label: 'Cerrada', labelTone: 'text-muted-foreground' }
  }

  return {
    dotTone: hasUnread ? 'text-foreground' : null,
    label: null,
    labelTone: 'text-muted-foreground',
  }
}

/**
 * The company's messages say who wrote them; the customer's go bare, like a
 * WhatsApp group. Without it "Con gusto, si necesitas algo más…" and a customer
 * still waiting for an answer look the same.
 */
const PREFIX_BY_AUTHOR = { agent: 'Agente: ', operator: 'Asesor: ', contact: '' } as const

export const previewOf = (conversation: ConversationSummary): string => {
  if (!conversation.lastMessagePreview) return 'Sin mensajes'

  const prefix = conversation.lastMessageAuthor
    ? PREFIX_BY_AUTHOR[conversation.lastMessageAuthor]
    : ''

  return `${prefix}${conversation.lastMessagePreview}`
}

interface ContactNames {
  /** What WhatsApp shows first: the phone, or the username of a customer with none. */
  primary: string
  /** The name the customer gave themselves, smaller beside it. */
  secondary: string | null
}

/**
 * The phone or the username first and the profile name beside it, small and
 * after a tilde, the way WhatsApp shows a contact the business never saved. The
 * profile name is whatever the customer typed, emojis and punctuation included,
 * and on its own it does not tell an operator who wrote.
 *
 * A username customer who has not written since usernames were stored has
 * neither, and falls back to the name.
 */
export const contactNamesOf = ({ contact }: ConversationSummary): ContactNames => {
  const handle = contact.phone ? formatPhone(contact.phone) : contact.username

  if (handle) {
    return { primary: handle, secondary: contact.displayName ? `~${contact.displayName}` : null }
  }

  return { primary: contact.displayName ?? 'Usuario de WhatsApp', secondary: null }
}
