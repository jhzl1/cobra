import { skipToken, useQuery } from '@tanstack/react-query'
import type { OpenHeldReceiptCount } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/**
 * How many held receipts wait for an operator; nothing is asked while there is
 * no company. Kept live by the company's channel: holding a receipt hands its
 * conversation to a person, and that change is what the channel broadcasts.
 */
export const useOpenHeldReceiptCountQuery = (tenantId: string | null) =>
  useQuery({
    queryKey: queryKeys.openHeldReceiptCount(tenantId ?? ''),
    queryFn: tenantId
      ? async () => {
          const { data } = await api.get<OpenHeldReceiptCount>(
            `/tenants/${tenantId}/held-receipts/open-count`,
          )

          return data.total
        }
      : skipToken,
  })
