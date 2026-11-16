import { Link } from '@tanstack/react-router'
import { ConversationList } from '~/components/ConversationList'
import { Button } from '~/components/ui/button'
import { Spinner } from '~/components/ui/spinner'
import { useInbox } from '~/contexts/InboxContext/useInbox'
import { useConversationSearchQuery } from '../hooks/queries/useConversationSearchQuery'

interface InboxListProps {
  tenantId: string
  /** What the operator searched for; without it, the latest conversations. */
  search: string | undefined
  selectedId: string | null
  onSelect: (conversationId: string) => void
}

export const InboxList = ({ tenantId, search, selectedId, onSelect }: InboxListProps) => {
  const inbox = useInbox()
  const searchResults = useConversationSearchQuery(tenantId, search)

  if (search && searchResults.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-5" />
      </div>
    )
  }

  if (search && searchResults.error) {
    return <p className="p-4 text-sm text-destructive">{searchResults.error.message}</p>
  }

  if (search) {
    if (!searchResults.data?.length) {
      return (
        <p className="p-4 text-sm text-muted-foreground">
          Ninguna conversación abierta coincide con «{search}».
        </p>
      )
    }

    return (
      <ConversationList
        conversations={searchResults.data}
        isUnread={inbox.isUnread}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    )
  }

  if (inbox.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="size-5" />
      </div>
    )
  }

  // An empty list explains nothing: four things have to be true before a
  // message can arrive, and three of them live on another screen.
  if (!inbox.conversations.length) {
    return (
      <div className="flex flex-col items-start gap-3 p-4">
        <p className="text-sm text-muted-foreground">Aún no hay conversaciones.</p>
        <Button asChild size="sm" variant="secondary">
          <Link to="/$tenantId/setup" params={{ tenantId }}>
            Revisar la puesta en marcha
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <ConversationList
      conversations={inbox.conversations}
      isUnread={inbox.isUnread}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  )
}
