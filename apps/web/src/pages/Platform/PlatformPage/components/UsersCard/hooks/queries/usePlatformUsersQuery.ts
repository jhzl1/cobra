import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Page, PlatformUser } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const usePlatformUsersQuery = (page: number) =>
  useQuery({
    queryKey: queryKeys.platformUserPage(page),
    queryFn: async () => {
      const { data } = await api.get<Page<PlatformUser>>('/platform/users', { params: { page } })

      return data
    },
    // The rows on screen stay while the next page loads, instead of a spinner.
    placeholderData: keepPreviousData,
  })
