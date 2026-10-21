import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { AgentRun } from '@cobra/contracts'
import { ChatPanel } from '~/components/ChatPanel'
import { ConversationList } from '~/components/ConversationList'
import { Timeline } from '~/components/Timeline'
import { Button } from '~/components/ui/button'
import { Card } from '~/components/ui/card'
import { Spinner } from '~/components/ui/spinner'
import { useConversationStream } from '~/hooks/useConversationStream'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'
import { useInbox } from '~/providers/InboxProvider'

interface Props {
  /** From the path. Null on /chats, which is the list with nothing open. */
  conversationId: string | null
}

export const WorkspacePage = ({ conversationId }: Props) => {
  const navigate = useNavigate()
  const inbox = useInbox()

  // What is on screen stops counting as unread, and stops interrupting.
  useEffect(() => {
    inbox.setOpen(conversationId)

    return () => inbox.setOpen(null)
  }, [conversationId, inbox])

  const runs = useQuery({
    queryKey: queryKeys.runs(conversationId ?? ''),
    enabled: !!conversationId,
    queryFn: async () => {
      const { data } = await api.get<AgentRun[]>(`/conversations/${conversationId}/runs`)

      return data
    },
  })

  /**
   * The live half. The two queries above are the source of truth — Realtime
   * retains its messages for days, not forever — and this only tells them when
   * to refetch.
   */
  useConversationStream(conversationId)

  const selected = inbox.conversations.find((conversation) => conversation.id === conversationId)

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
      <Card className="col-span-3 gap-0 overflow-y-auto py-0">
        {inbox.loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : inbox.conversations.length ? (
          <ConversationList
            conversations={inbox.conversations}
            isUnread={inbox.isUnread}
            selectedId={conversationId}
            onSelect={(id) =>
              void navigate({ to: '/chats/$conversationId', params: { conversationId: id } })
            }
          />
        ) : (
          /* An empty list explains nothing: four things have to be true before a
             message can arrive, and three of them live on another screen. */
          <div className="flex h-full flex-col items-start justify-center gap-3 p-4">
            <p className="text-sm text-muted-foreground">
              Todavía no ha llegado ninguna conversación.
            </p>
            <Button asChild size="sm" variant="secondary">
              <Link to="/setup">Ver qué falta</Link>
            </Button>
          </div>
        )}
      </Card>

      <div className="col-span-6 min-h-0">
        {selected ? (
          <ChatPanel conversation={selected} />
        ) : (
          <Card className="flex h-full items-center justify-center py-0">
            <p className="text-sm text-muted-foreground">Elige una conversación</p>
          </Card>
        )}
      </div>

      <Card className="col-span-3 gap-0 overflow-y-auto p-2">
        <h2 className="px-2 pb-2 text-sm font-medium">Timeline</h2>
        <Timeline runs={runs.data ?? []} />
      </Card>
    </div>
  )
}
