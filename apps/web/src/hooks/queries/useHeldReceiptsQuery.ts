import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { HeldReceipt, HeldReceiptStatus, Page } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/** While a receipt is being applied, the list asks again this often. */
const APPLYING_POLL_MS = 3_000

/**
 * One page of a company's held receipts, still open or already resolved.
 *
 * Applying runs in the worker, so a receipt sits in `applying` for a few
 * seconds. The list polls only while one does, and stops once it settles.
 */
export const useHeldReceiptsQuery = ({
  tenantId,
  status,
  page,
}: {
  tenantId: string
  status: HeldReceiptStatus
  page: number
}) =>
  useQuery({
    queryKey: queryKeys.heldReceiptPage({ tenantId, status, page }),
    queryFn: async () => {
      const { data } = await api.get<Page<HeldReceipt>>(`/tenants/${tenantId}/held-receipts`, {
        params: { page, status },
      })

      return data
    },
    // The receipts on screen stay while the next page loads, instead of a spinner.
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.items.some((receipt) => receipt.resolution === 'applying')
        ? APPLYING_POLL_MS
        : false,
  })
