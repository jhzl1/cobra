import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Lead, Page } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/** Demo requests from the landing page, newest first. */
export const usePlatformLeadsQuery = (page: number) =>
  useQuery({
    queryKey: queryKeys.platformLeadPage(page),
    queryFn: async () => {
      const { data } = await api.get<Page<Lead>>('/platform/leads', { params: { page } })

      return data
    },
    // The rows on screen stay while the next page loads, instead of a spinner.
    placeholderData: keepPreviousData,
  })
