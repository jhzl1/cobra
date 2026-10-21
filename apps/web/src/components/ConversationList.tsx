import type { ConversationSummary } from '@cobra/contracts'
import { cn } from '~/lib/utils'

interface Props {
  conversations: ConversationSummary[]
  selectedId: string | null
  isUnread: (conversation: ConversationSummary) => boolean
  onSelect: (conversationId: string) => void
}

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
const stateOf = (conversation: ConversationSummary): State => {
  if (conversation.lastRunFailed) return { label: 'Falló', tone: 'text-destructive' }
  if (conversation.status === 'human') return { label: 'Operador', tone: 'text-warning' }
  if (conversation.status === 'closed')
    return { label: 'Cerrada', tone: 'text-disabled-foreground' }

  return { label: 'Agente', tone: 'text-muted-foreground' }
}

const formatWhen = (iso: string | null): string => {
  if (!iso) return ''

  const date = new Date(iso)
  const today = new Date().toDateString() === date.toDateString()

  return today
    ? date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
    : date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })
}

/**
 * A list of buttons rather than shadcn's `Command`, which is a palette with a
 * filter of its own: all this has to do is pick a conversation, and buttons give
 * focus and keyboard navigation for free.
 *
 * Unread is not a second badge. The row keeps its state and takes weight
 * instead — the name bolder, the preview at full contrast, the time in the
 * attention colour — and holds it until the operator opens it.
 */
export const ConversationList = ({ conversations, selectedId, isUnread, onSelect }: Props) => (
  <ul className="flex flex-col">
    {conversations.map((conversation) => {
      const active = conversation.id === selectedId
      const unread = isUnread(conversation)
      const state = stateOf(conversation)

      return (
        <li key={conversation.id} className="border-b">
          <button
            type="button"
            aria-current={active ? 'true' : undefined}
            aria-label={unread ? 'Conversación con mensajes sin leer' : undefined}
            onClick={() => onSelect(conversation.id)}
            className={cn(
              'grid w-full cursor-pointer grid-cols-[8px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5 px-4 py-2.5 text-left transition-colors duration-100',
              'outline-none focus-visible:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset',
              active ? 'bg-secondary' : 'hover:bg-accent/60',
            )}
          >
            <span
              aria-hidden
              className={cn('size-2 self-center rounded-full bg-current', state.tone)}
            />

            <span
              className={cn(
                'truncate font-display text-sm',
                unread ? 'font-semibold text-foreground' : 'font-medium',
              )}
            >
              {conversation.contact.displayName ?? (
                <span className="font-mono">
                  {conversation.contact.phone ?? conversation.contact.personId}
                </span>
              )}
            </span>

            <span
              className={cn('font-mono text-xs', unread ? 'text-warning' : 'text-muted-foreground')}
            >
              {formatWhen(conversation.lastMessageAt)}
            </span>

            <span
              className={cn(
                'col-start-2 truncate text-xs',
                unread ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {conversation.lastMessagePreview ?? 'Sin mensajes'}
            </span>

            <span className={cn('text-right text-xs', state.tone)}>{state.label}</span>
          </button>
        </li>
      )
    })}
  </ul>
)
