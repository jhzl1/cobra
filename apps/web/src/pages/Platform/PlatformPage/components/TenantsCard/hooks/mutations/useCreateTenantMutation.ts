import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateTenantInput, TemporaryPassword } from '@cobra/contracts'
import { api } from '~/api/client'
import { invalidateTenantLists, queryKeys } from '~/lib/queryClient'

export const useCreateTenantMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (details: CreateTenantInput) => {
      const { data } = await api.post<{ temporaryPassword: TemporaryPassword }>('/tenants', details)

      return data.temporaryPassword
    },
    // The first user is a new account too, so the users tab changes as well.
    onSuccess: () =>
      Promise.all([
        invalidateTenantLists(queryClient),
        queryClient.invalidateQueries({ queryKey: queryKeys.platformUsers }),
      ]),
  })
}
