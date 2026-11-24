import { useMutation } from '@tanstack/react-query'
import type { CreateLeadInput } from '@cobra/contracts'
import { api } from '~/api/client'

export const useCreateLeadMutation = () =>
  useMutation({
    mutationFn: async (lead: CreateLeadInput) => {
      await api.post('/leads', lead)
    },
  })
