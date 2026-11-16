import type { ConversationSummary } from '@cobra/contracts'
import { cn } from '~/lib/utils'
import { formatTimeOrDay } from '~/utils/formatters'
import { stateOf } from './helpers'

interface ConversationListProps {
  conversations: ConversationSummary[]
  selectedId: string | null
  isUnread: (conversation: ConversationSummary) => boolean
  onSelect: (conversationId: string) => void
}

/**
 * A list of buttons rather than shadcn's `Command`, which is a palette with a
 * filter of its own: all this has to do is pick a conversation, and buttons give
 * focus and keyboard navigation for free.
 *
 * Unread is not a second badge and takes no colour, which belongs to state.
 * The row takes weight instead — the name bolder, the preview and the time at
 * full contrast — and holds it until the operator opens it.
 */
export const ConversationList = ({
  conversations,
  selectedId,
  isUnread,
  onSelect,
}: ConversationListProps) => (
  <ul className="flex flex-col">
    {conversations.map((conversation) => {
      const isSelected = conversation.id === selectedId
      const hasUnread = isUnread(conversation)
      const state = stateOf(conversation)

      return (
        <li key={conversation.id} className="border-b">
          <button
            type="button"
            aria-current={isSelected ? 'true' : undefined}
            aria-label={hasUnread ? 'Conversación con mensajes sin leer' : undefined}
            onClick={() => onSelect(conversation.id)}
            className={cn(
              'grid w-full cursor-pointer grid-cols-[8px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5 px-4 py-2.5 text-left transition-colors duration-100',
              'outline-none focus-visible:bg-accent focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset',
              isSelected ? 'bg-secondary' : 'hover:bg-accent/60',
            )}
          >
            <span
              aria-hidden
              className={cn('size-2 self-center rounded-full bg-current', state.tone)}
            />

            <span
              className={cn(
                'truncate font-display text-sm',
                hasUnread ? 'font-semibold text-foreground' : 'font-medium',
              )}
            >
              {conversation.contact.displayName ?? (
                <span className="font-mono">
                  {conversation.contact.phone ?? conversation.contact.personId}
                </span>
              )}
            </span>

            <span
              className={cn(
                'font-mono text-xs',
                hasUnread ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {formatTimeOrDay(conversation.lastMessageAt)}
            </span>

            <span
              className={cn(
                'col-start-2 truncate text-xs',
                hasUnread ? 'text-foreground' : 'text-muted-foreground',
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
