import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useRevokeRoleMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (grantId: string) => {
      await api.delete(`/platform/roles/${grantId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.roleGrants }),
  })
}
