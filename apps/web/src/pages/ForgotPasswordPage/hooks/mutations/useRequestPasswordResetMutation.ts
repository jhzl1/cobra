import { useMutation } from '@tanstack/react-query'
import { api } from '~/api/client'

export const useRequestPasswordResetMutation = () =>
  useMutation({
    mutationFn: async (email: string) => {
      await api.post('/password-reset-requests', { email })
    },
  })
