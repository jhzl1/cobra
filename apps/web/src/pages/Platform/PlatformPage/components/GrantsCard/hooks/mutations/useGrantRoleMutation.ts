import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/** ADMIN is the one platform role there is, so only the address travels. */
export const useGrantRoleMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (email: string) => {
      await api.post('/platform/roles', { email, role: 'ADMIN' })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roleGrants }),
  })
}
