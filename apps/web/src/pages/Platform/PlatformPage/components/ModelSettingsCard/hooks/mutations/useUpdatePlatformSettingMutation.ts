import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PlatformSettingKey } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

interface UpdatePlatformSettingVariables {
  key: PlatformSettingKey
  /** Null removes a fallback model; the task's own model always has one. */
  value: string | null
}

export const useUpdatePlatformSettingMutation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ key, value }: UpdatePlatformSettingVariables) => {
      await api.put(`/platform/settings/${key}`, { value })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.platformSettings }),
  })
}
