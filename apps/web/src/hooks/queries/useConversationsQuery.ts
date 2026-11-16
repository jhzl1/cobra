import { useQuery } from '@tanstack/react-query'
import type { ConversationSummary } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/** A company's conversations; nothing is asked while there is no company. */
export const useConversationsQuery = (tenantId: string | null) =>
  useQuery({
    queryKey: queryKeys.conversations(tenantId ?? ''),
    enabled: !!tenantId,
    queryFn: async () => {
      const { data } = await api.get<ConversationSummary[]>('/conversations', {
        params: { tenantId },
      })

      return data
    },
  })
