import { useQuery } from '@tanstack/react-query'
import type { TenantSetup } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useTenantSetupQuery = (tenantId: string) =>
  useQuery({
    queryKey: queryKeys.setup(tenantId),
    queryFn: async () => {
      const { data } = await api.get<TenantSetup>(`/tenants/${tenantId}/setup`)

      return data
    },
  })
