import type { ConversationSummary } from '@cobra/contracts'
import { Badge } from '~/components/ui/badge'
import { cn } from '~/lib/utils'

interface Props {
  conversations: ConversationSummary[]
  selectedId: string | null
  isUnread: (conversation: ConversationSummary) => boolean
  onSelect: (conversationId: string) => void
}

const STATUS_LABEL: Record<ConversationSummary['status'], string> = {
  bot: 'Agente',
  human: 'Operador',
  closed: 'Cerrada',
}

/**
 * HeroUI gave this as a Listbox. shadcn has no equivalent and its `Command` is
 * a palette with a filter of its own, which here only gets in the way: all this
 * has to do is pick a conversation. A list of buttons gives focus and keyboard
 * navigation for free.
 *
 * The selected row uses `bg-secondary` without the secondary button's border.
 * That is deliberate: here the grey means *selected*, not *available action*.
 */
export const ConversationList = ({ conversations, selectedId, isUnread, onSelect }: Props) => (
  <ul aria-label="Conversaciones" className="flex flex-col p-1">
    {conversations.map((conversation) => {
      const active = conversation.id === selectedId
      const unread = isUnread(conversation)

      return (
        <li key={conversation.id}>
          <button
            type="button"
            aria-current={active ? 'true' : undefined}
            aria-label={unread ? 'Conversación con mensajes sin leer' : undefined}
            onClick={() => onSelect(conversation.id)}
            className={cn(
              'flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 text-left transition-colors',
              'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              active ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent/50',
            )}
          >
            {/* A dot and not a count: what matters is that something arrived,
                and the number would be a second thing to keep accurate. */}
            <span
              aria-hidden
              className={cn(
                'size-2 shrink-0 rounded-full',
                unread ? 'bg-warning' : 'bg-transparent',
              )}
            />

            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>
                {conversation.contact.displayName ??
                  conversation.contact.phone ??
                  conversation.contact.personId}
              </p>
              <p
                className={cn(
                  'truncate text-xs',
                  unread ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {conversation.lastMessagePreview ?? 'Sin mensajes'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {/* The failed-turn tray: a conversation whose last run died has to be
                  visible here, not buried in a log. */}
              {conversation.lastRunFailed && <Badge variant="destructive">Falló</Badge>}
              <Badge variant={conversation.status === 'human' ? 'warning' : 'default'}>
                {STATUS_LABEL[conversation.status]}
              </Badge>
            </div>
          </button>
        </li>
      )
    })}
  </ul>
)
