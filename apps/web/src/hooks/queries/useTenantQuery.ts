import { useQuery } from '@tanstack/react-query'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'
import type { TenantSummary } from '~/types/tenant'

/** One company, fresh: what its settings and the platform show of it. */
export const useTenantQuery = (tenantId: string) =>
  useQuery({
    queryKey: queryKeys.tenant(tenantId),
    queryFn: async () => {
      const { data } = await api.get<TenantSummary>(`/tenants/${tenantId}`)

      return data
    },
  })
