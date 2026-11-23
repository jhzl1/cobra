import { useQuery } from '@tanstack/react-query'
import type { WisphubNamedEntity } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/**
 * The accounts as Wisphub knows them. Typing the id by hand was the old way,
 * and a wrong one registers the payment under the wrong account without
 * complaining — Wisphub accepts any id it recognises.
 */
export const useWisphubPaymentMethodsQuery = (tenantId: string) =>
  useQuery({
    queryKey: queryKeys.wisphubPaymentMethods(tenantId),
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<WisphubNamedEntity[]>(
        `/tenants/${tenantId}/wisphub/payment-methods`,
      )

      return data
    },
  })
