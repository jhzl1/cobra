import { useQuery } from '@tanstack/react-query'
import type { AgentRun } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/**
 * The agent's turns in a conversation, newest first. The timeline and the
 * chat's thinking bubble read the same cache, so the stream that keeps one live
 * keeps the other live too. Nothing is asked while no conversation is open.
 */
export const useConversationRunsQuery = (conversationId: string | null) =>
  useQuery({
    queryKey: queryKeys.runs(conversationId ?? ''),
    enabled: !!conversationId,
    queryFn: async () => {
      const { data } = await api.get<AgentRun[]>(`/conversations/${conversationId}/runs`)

      return data
    },
  })
