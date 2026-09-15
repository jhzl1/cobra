import { Chip, Listbox, ListboxItem } from '@heroui/react'
import type { ConversationSummary } from '@cobra/contracts'

interface Props {
  conversations: ConversationSummary[]
  selectedId: string | null
  onSelect: (conversationId: string) => void
}

const STATUS_LABEL: Record<ConversationSummary['status'], string> = {
  bot: 'Agente',
  human: 'Operador',
  closed: 'Cerrada',
}

export const ConversationList = ({ conversations, selectedId, onSelect }: Props) => (
  <Listbox
    aria-label="Conversaciones"
    selectionMode="single"
    selectedKeys={selectedId ? [selectedId] : []}
    onAction={(key) => onSelect(String(key))}
    className="p-0"
  >
    {conversations.map((conversation) => (
      <ListboxItem key={conversation.id} textValue={conversation.contact.displayName ?? ''}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {conversation.contact.displayName ?? conversation.contact.phone ?? conversation.contact.personId}
            </p>
            <p className="text-default-500 truncate text-xs">
              {conversation.lastMessagePreview ?? 'Sin mensajes'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {/* The failed-turn tray: a conversation whose last run died has to be
                visible here, not buried in a log. */}
            {conversation.lastRunFailed && (
              <Chip size="sm" color="danger" variant="flat">
                Falló
              </Chip>
            )}
            <Chip size="sm" variant="flat" color={conversation.status === 'human' ? 'warning' : 'default'}>
              {STATUS_LABEL[conversation.status]}
            </Chip>
          </div>
        </div>
      </ListboxItem>
    ))}
  </Listbox>
)
