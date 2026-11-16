import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query'
import type { ConversationSummary } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/** The company's open conversations whose customer matches the search; nothing without one. */
export const useConversationSearchQuery = (tenantId: string, search: string | undefined) =>
  useQuery({
    queryKey: queryKeys.conversationSearch(tenantId, search ?? ''),
    queryFn: search
      ? async () => {
          const { data } = await api.get<ConversationSummary[]>('/conversations', {
            params: { tenantId, search },
          })

          return data
        }
      : skipToken,
    // The previous results stay while the next ones load, instead of a spinner per key.
    placeholderData: keepPreviousData,
  })
