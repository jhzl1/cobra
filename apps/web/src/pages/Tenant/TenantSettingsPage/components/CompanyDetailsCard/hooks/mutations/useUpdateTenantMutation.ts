import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateTenantInput } from '@cobra/contracts'
import { api } from '~/api/client'
import { invalidateTenantLists, queryKeys } from '~/lib/queryClient'

export const useUpdateTenantMutation = (tenantId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (details: CreateTenantInput) => {
      await api.patch(`/tenants/${tenantId}`, details)
    },
    // The name also shows in the company list and the platform's table.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenant(tenantId) })
      await invalidateTenantLists(queryClient)
    },
  })
}
