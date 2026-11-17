import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { TemporaryPassword } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useCreateAdminMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await api.post<TemporaryPassword>('/platform/admins', { email })

      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.platformUsers }),
  })
}
