import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApplyHeldReceiptInput } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

interface ApplyHeldReceiptVariables {
  receiptId: string
  payment: ApplyHeldReceiptInput
}

export const useApplyHeldReceiptMutation = (tenantId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ receiptId, payment }: ApplyHeldReceiptVariables) => {
      await api.post(`/tenants/${tenantId}/held-receipts/${receiptId}/apply`, payment)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.heldReceipts(tenantId) }),
  })
}
