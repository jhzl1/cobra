import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Page, PlatformError } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/** Every failed attempt of every company, newest first. */
export const usePlatformErrorsQuery = (page: number) =>
  useQuery({
    queryKey: queryKeys.platformErrorPage(page),
    queryFn: async () => {
      const { data } = await api.get<Page<PlatformError>>('/platform/errors', { params: { page } })

      return data
    },
    // The rows on screen stay while the next page loads, instead of a spinner.
    placeholderData: keepPreviousData,
  })
