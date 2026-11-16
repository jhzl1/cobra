import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { HandoffInput } from '@cobra/contracts'
import { api } from '~/api/client'

/** Who answers the conversation: the agent, or the operator who takes it. */
export const useHandoffMutation = (conversationId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (action: HandoffInput['action']) => {
      await api.post(`/conversations/${conversationId}/handoff`, { action })
    },
    // Every company's list and every open thread show the status, so all of them.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
  })
}
