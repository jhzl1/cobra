import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Page } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'
import type { TenantSummary } from '~/types/tenant'

/** Its own paginated endpoint: `GET /tenants` stays whole for the company switcher. */
export const usePlatformTenantsQuery = (page: number) =>
  useQuery({
    queryKey: queryKeys.platformTenantPage(page),
    queryFn: async () => {
      const { data } = await api.get<Page<TenantSummary>>('/platform/tenants', { params: { page } })

      return data
    },
    // The rows on screen stay while the next page loads, instead of a spinner.
    placeholderData: keepPreviousData,
  })
