import { useQuery } from '@tanstack/react-query'
import type { WhatsappNumber } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

/** Every number the company connected, the retired ones included. */
export const useWhatsappNumbersQuery = (tenantId: string) =>
  useQuery({
    queryKey: queryKeys.whatsappNumbers(tenantId),
    queryFn: async () => {
      const { data } = await api.get<WhatsappNumber[]>(`/tenants/${tenantId}/whatsapp-numbers`)

      return data
    },
  })
