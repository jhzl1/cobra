import { useQuery } from '@tanstack/react-query'
import type { WisphubNamedEntity } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useWisphubZonesQuery = (tenantId: string) =>
  useQuery({
    queryKey: queryKeys.wisphubZones(tenantId),
    retry: false,
    queryFn: async () => {
      const { data } = await api.get<WisphubNamedEntity[]>(`/tenants/${tenantId}/wisphub/zones`)

      return data
    },
  })
