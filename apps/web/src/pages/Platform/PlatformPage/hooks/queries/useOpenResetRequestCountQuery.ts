import { useQuery } from '@tanstack/react-query'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useOpenResetRequestCountQuery = () =>
  useQuery({
    queryKey: queryKeys.openResetRequestCount,
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>('/platform/password-reset-requests/count')

      return data.count
    },
    // Nothing broadcasts a new request, and the person who sent it is waiting
    // for someone to notice.
    refetchInterval: 60_000,
  })
