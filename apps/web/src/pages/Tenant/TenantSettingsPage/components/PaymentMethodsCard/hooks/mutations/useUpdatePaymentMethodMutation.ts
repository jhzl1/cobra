import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PaymentMethodInput } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useUpdatePaymentMethodMutation = (tenantId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ methodId, input }: { methodId: string; input: PaymentMethodInput }) => {
      await api.put(`/tenants/${tenantId}/payment-methods/${methodId}`, input)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods(tenantId) }),
  })
}
