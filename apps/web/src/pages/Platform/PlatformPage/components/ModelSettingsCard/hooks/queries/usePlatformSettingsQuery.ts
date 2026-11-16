import { useQuery } from '@tanstack/react-query'
import type { PlatformSetting } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const usePlatformSettingsQuery = () =>
  useQuery({
    queryKey: queryKeys.platformSettings,
    queryFn: async () => {
      const { data } = await api.get<PlatformSetting[]>('/platform/settings')

      return data
    },
  })
