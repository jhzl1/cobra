import { Card, Spinner } from '@heroui/react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { AgentRun, ConversationSummary } from '@cobra/contracts'
import { ChatPanel } from '~/components/ChatPanel'
import { ConversationList } from '~/components/ConversationList'
import { Timeline } from '~/components/Timeline'
import { useConversationStream } from '~/hooks/useConversationStream'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'

export const WorkspacePage = ({ tenantId }: { tenantId: string }) => {
  const [conversationId, setConversationId] = useState<string | null>(null)

  const conversations = useQuery({
    queryKey: queryKeys.conversations(tenantId),
    queryFn: async () => {
      const { data } = await api.get<ConversationSummary[]>('/conversations', {
        params: { tenantId },
      })

      return data
    },
  })

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

  const selected = conversations.data?.find((conversation) => conversation.id === conversationId)

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
      <Card className="col-span-3 overflow-y-auto">
        {conversations.isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <ConversationList
            conversations={conversations.data ?? []}
            selectedId={conversationId}
            onSelect={setConversationId}
          />
        )}
      </Card>

      <div className="col-span-6 min-h-0">
        {selected ? (
          <ChatPanel conversation={selected} />
        ) : (
          <Card className="flex h-full items-center justify-center">
            <p className="text-sm text-default-500">Elige una conversación</p>
          </Card>
        )}
      </div>

      <Card className="col-span-3 overflow-y-auto p-2">
        <h2 className="px-2 pb-2 text-sm font-medium">Timeline</h2>
        <Timeline runs={runs.data ?? []} />
      </Card>
    </div>
  )
}
