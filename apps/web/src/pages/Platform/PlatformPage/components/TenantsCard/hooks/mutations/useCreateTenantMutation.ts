import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateTenantInput } from '@cobra/contracts'
import { api } from '~/api/client'
import { invalidateTenantLists } from '~/lib/queryClient'

export const useCreateTenantMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (details: CreateTenantInput) => {
      await api.post('/tenants', details)
    },
    onSuccess: () => invalidateTenantLists(queryClient),
  })
}
