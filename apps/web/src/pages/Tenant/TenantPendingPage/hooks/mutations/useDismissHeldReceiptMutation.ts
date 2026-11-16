import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

interface DismissHeldReceiptVariables {
  receiptId: string
  /** Absent outside WhatsApp's 24-hour window, where it could not be delivered. */
  note: string | undefined
}

export const useDismissHeldReceiptMutation = (tenantId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ receiptId, note }: DismissHeldReceiptVariables) => {
      await api.post(`/tenants/${tenantId}/held-receipts/${receiptId}/dismiss`, { note })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.heldReceipts(tenantId) }),
  })
}
