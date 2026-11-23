import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/** Revoking marks the grant and keeps it; the account stays and can still sign in. */
export const useRevokeAdminMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (grantId: string) => {
      await api.delete(`/platform/roles/${grantId}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.platformUsers }),
  })
}
