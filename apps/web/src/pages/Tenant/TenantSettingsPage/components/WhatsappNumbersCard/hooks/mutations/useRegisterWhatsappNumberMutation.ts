import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { RegisterWhatsappNumberInput } from '@cobra/contracts'
import { api } from '~/api/client'
import { queryKeys } from '~/lib/queryClient'

export const useRegisterWhatsappNumberMutation = (tenantId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (number: RegisterWhatsappNumberInput) => {
      await api.post(`/tenants/${tenantId}/whatsapp-numbers`, number)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.whatsappNumbers(tenantId) }),
  })
}
