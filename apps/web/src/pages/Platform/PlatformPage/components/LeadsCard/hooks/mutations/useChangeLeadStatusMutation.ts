import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { LeadStatus } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useChangeLeadStatusMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ leadId, status }: { leadId: string; status: LeadStatus }) => {
      await api.patch(`/platform/leads/${leadId}/status`, { status })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.platformLeads }),
  })
}
