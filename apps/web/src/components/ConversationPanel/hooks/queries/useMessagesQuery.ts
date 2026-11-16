import { useQuery } from '@tanstack/react-query'
import type { Message } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useMessagesQuery = (conversationId: string) =>
  useQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: async () => {
      const { data } = await api.get<Message[]>(`/conversations/${conversationId}/messages`)

      return data
    },
  })
