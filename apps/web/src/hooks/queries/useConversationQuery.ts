import { skipToken, useQuery } from '@tanstack/react-query'
import type { ConversationSummary } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/**
 * One conversation, for a link to one the loaded pages do not hold — a
 * notification, a shared URL. Null when the list already has it.
 */
export const useConversationQuery = (conversationId: string | null) =>
  useQuery({
    queryKey: queryKeys.conversation(conversationId ?? ''),
    queryFn: conversationId
      ? async () => {
          const { data } = await api.get<ConversationSummary>(`/conversations/${conversationId}`)

          return data
        }
      : skipToken,
  })
