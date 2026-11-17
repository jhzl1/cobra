import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useChangePasswordMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (password: string) => {
      await api.put('/me/password', { password })
    },
    // The guards read the identity from the cache; until it is refetched they
    // would send the person straight back here.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.platformIdentity }),
  })
}
