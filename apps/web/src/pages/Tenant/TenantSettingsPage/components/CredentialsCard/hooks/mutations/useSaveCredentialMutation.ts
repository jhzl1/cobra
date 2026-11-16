import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SaveCredentialInput } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useSaveCredentialMutation = (tenantId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (credential: SaveCredentialInput) => {
      await api.put(`/tenants/${tenantId}/credentials`, credential)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.credentials(tenantId) }),
  })
}
