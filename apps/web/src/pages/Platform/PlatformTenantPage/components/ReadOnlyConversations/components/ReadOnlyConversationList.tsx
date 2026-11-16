import { ConversationList } from '~/components/ConversationList'
import { useConversationsQuery } from '~/hooks/queries/useConversationsQuery'
import { CenteredSpinner } from '../../CenteredSpinner'

interface ReadOnlyConversationListProps {
  tenantId: string
  selectedId: string | null
  onSelect: (conversationId: string) => void
}

export const ReadOnlyConversationList = ({
  tenantId,
  selectedId,
  onSelect,
}: ReadOnlyConversationListProps) => {
  const conversations = useConversationsQuery(tenantId)

  if (conversations.isLoading) return <CenteredSpinner />

  if (!conversations.data?.length) {
    return <p className="p-4 text-sm text-muted-foreground">Aún no hay conversaciones.</p>
  }

  return (
    <ConversationList
      conversations={conversations.data}
      // Unread belongs to whoever answers the company's chats.
      isUnread={() => false}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  )
}
