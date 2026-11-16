import { useQuery } from '@tanstack/react-query'
import type { PlatformRoleGrant } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useRoleGrantsQuery = () =>
  useQuery({
    queryKey: queryKeys.roleGrants,
    queryFn: async () => {
      const { data } = await api.get<PlatformRoleGrant[]>('/platform/roles')

      return data
    },
  })
