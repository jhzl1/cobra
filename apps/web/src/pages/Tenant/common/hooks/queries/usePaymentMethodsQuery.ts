import { useQuery } from '@tanstack/react-query'
import type { PaymentMethodSummary } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/** The company's collection accounts: where its customers send their money. */
export const usePaymentMethodsQuery = (tenantId: string) =>
  useQuery({
    queryKey: queryKeys.paymentMethods(tenantId),
    queryFn: async () => {
      const { data } = await api.get<PaymentMethodSummary[]>(`/tenants/${tenantId}/payment-methods`)

      return data
    },
  })
