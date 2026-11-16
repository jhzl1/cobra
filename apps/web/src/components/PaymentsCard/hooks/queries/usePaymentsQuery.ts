import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { PaymentPage } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'
import type { PaymentRange } from '../../types'

interface PaymentsQueryInput {
  tenantId: string
  page: number
  range: PaymentRange
}

export const usePaymentsQuery = ({ tenantId, page, range }: PaymentsQueryInput) =>
  useQuery({
    queryKey: queryKeys.paymentPage({ tenantId, page, ...range }),
    queryFn: async () => {
      const { data } = await api.get<PaymentPage>(`/tenants/${tenantId}/payments`, {
        params: { page, from: range.from, to: range.to },
      })

      return data
    },
    // The rows on screen stay while the next page loads, instead of a spinner.
    placeholderData: keepPreviousData,
  })
