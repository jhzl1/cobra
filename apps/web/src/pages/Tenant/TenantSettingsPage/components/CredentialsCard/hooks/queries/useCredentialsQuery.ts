import { useQuery } from '@tanstack/react-query'
import type { CredentialSummary } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useCredentialsQuery = (tenantId: string) =>
  useQuery({
    queryKey: queryKeys.credentials(tenantId),
    queryFn: async () => {
      const { data } = await api.get<CredentialSummary[]>(`/tenants/${tenantId}/credentials`)

      return data
    },
  })
