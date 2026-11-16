import type { ConversationSummary } from '@cobra/contracts'
import { cn } from '~/lib/utils'
import { formatTimeOrDay } from '~/utils/formatters'
import { contactNamesOf, previewOf, stateOf } from './helpers'

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
      const state = stateOf(conversation, hasUnread)
      const names = contactNamesOf(conversation)

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
            {/* The column stays when there is no dot, so the names keep their line. */}
            <span
              aria-hidden
              className={cn(
                'size-2 self-center rounded-full',
                state.dotTone && cn('bg-current', state.dotTone),
              )}
            />

            <span className="flex min-w-0 items-baseline gap-1.5">
              <span
                className={cn(
                  'shrink-0 font-display text-sm',
                  hasUnread ? 'font-semibold text-foreground' : 'font-medium',
                )}
              >
                {names.primary}
              </span>
              {names.secondary && (
                <span className="truncate text-xs text-muted-foreground">{names.secondary}</span>
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
              {previewOf(conversation)}
            </span>

            <span className={cn('text-right text-xs', state.labelTone)}>{state.label}</span>
          </button>
        </li>
      )
    })}
  </ul>
)
