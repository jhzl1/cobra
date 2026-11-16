import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useRetireWhatsappNumberMutation = (tenantId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (numberId: string) => {
      await api.delete(`/tenants/${tenantId}/whatsapp-numbers/${numberId}`)
    },
    // Setup counts a connected number as one of its steps.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.whatsappNumbers(tenantId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.setup(tenantId) })
    },
  })
}
