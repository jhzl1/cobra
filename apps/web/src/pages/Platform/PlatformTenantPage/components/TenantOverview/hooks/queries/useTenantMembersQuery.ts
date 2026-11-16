import { useQuery } from '@tanstack/react-query'
import type { TenantMember } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useTenantMembersQuery = (tenantId: string) =>
  useQuery({
    queryKey: queryKeys.members(tenantId),
    queryFn: async () => {
      const { data } = await api.get<TenantMember[]>(`/tenants/${tenantId}/members`)

      return data
    },
  })
