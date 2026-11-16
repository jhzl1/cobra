import { queryOptions } from '@tanstack/react-query'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'
import type { TenantSummary } from '~/types/tenant'

/** The companies this account reaches. */
export const tenantsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.tenants,
    queryFn: async () => {
      const { data } = await api.get<TenantSummary[]>('/tenants')

      return data
    },
  })
