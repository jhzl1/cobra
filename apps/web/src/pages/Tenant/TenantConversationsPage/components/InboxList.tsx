import { Link } from '@tanstack/react-router'
import { ConversationList } from '~/components/ConversationList'
import { Button } from '~/components/ui/button'
import { Spinner } from '~/components/ui/spinner'
import { useInbox } from '~/contexts/InboxContext/useInbox'

interface InboxListProps {
  tenantId: string
  selectedId: string | null
  onSelect: (conversationId: string) => void
}

export const InboxList = ({ tenantId, selectedId, onSelect }: InboxListProps) => {
  const inbox = useInbox()

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
