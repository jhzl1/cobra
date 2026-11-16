import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useDeletePaymentMethodMutation = (tenantId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (methodId: string) => {
      await api.delete(`/tenants/${tenantId}/payment-methods/${methodId}`)
    },
    // Setup only counts active accounts towards its step.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.setup(tenantId) }),
      ]),
  })
}
