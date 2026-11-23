import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TemporaryPassword } from '@cobra/contracts'
import { api } from '~/api/client'
import { invalidateTenantLists, queryKeys } from '~/lib/queryClient'

export const useCreateCompanyUserMutation = (tenantId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.post<TemporaryPassword>(`/platform/tenants/${tenantId}/users`, {
        email,
      })

      return data
    },
    // The members listed here, the count on the company, the platform's table
    // of companies and its users tab all change.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.members(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenant(tenantId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.platformUsers }),
        invalidateTenantLists(queryClient),
      ]),
  })
}
