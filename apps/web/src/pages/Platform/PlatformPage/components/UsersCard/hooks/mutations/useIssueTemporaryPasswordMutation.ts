import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TemporaryPassword } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useIssueTemporaryPasswordMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.post<TemporaryPassword>(
        `/platform/users/${userId}/temporary-password`,
      )

      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.platformUsers }),
  })
}
