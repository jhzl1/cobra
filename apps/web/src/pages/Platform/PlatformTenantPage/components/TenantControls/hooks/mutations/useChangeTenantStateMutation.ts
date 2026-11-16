import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UpdateTenantDryRunInput, UpdateTenantStatusInput } from '@cobra/contracts'
import { api } from '~/api/client'
import { invalidateTenantLists, queryKeys } from '~/lib/queryClient'
import type { Change } from '../../types'

export const useChangeTenantStateMutation = (tenantId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (requested: Change) => {
      if (requested === 'agent-off' || requested === 'agent-on') {
        const body: UpdateTenantStatusInput = {
          status: requested === 'agent-on' ? 'active' : 'suspended',
        }

        await api.patch(`/tenants/${tenantId}/status`, body)

        return
      }

      const body: UpdateTenantDryRunInput = { dryRun: requested === 'dry-run-on' }

      await api.patch(`/tenants/${tenantId}/dry-run`, body)
    },
    // The detail and the setup carry the same two fields as the lists.
    onSuccess: () => {
      void invalidateTenantLists(queryClient)
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenant(tenantId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.setup(tenantId) })
    },
  })
}
