import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useSendMessageMutation = (conversationId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (body: string) => {
      await api.post(`/conversations/${conversationId}/messages`, { body })
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) }),
  })
}
