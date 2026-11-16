import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useChangePaymentMethodStatusMutation = (tenantId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ methodId, isActive }: { methodId: string; isActive: boolean }) => {
      await api.patch(`/tenants/${tenantId}/payment-methods/${methodId}/status`, { isActive })
    },
    // Setup only counts active accounts towards its step.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.setup(tenantId) }),
      ]),
  })
}
