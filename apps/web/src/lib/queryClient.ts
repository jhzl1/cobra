import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The live data arrives over Realtime, so refetching on every window focus
      // only duplicates work.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export const queryKeys = {
  tenants: ['tenants'] as const,
  credentials: (tenantId: string) => ['tenants', tenantId, 'credentials'] as const,
  numbers: (tenantId: string) => ['tenants', tenantId, 'numbers'] as const,
  paymentMethods: (tenantId: string) => ['tenants', tenantId, 'payment-methods'] as const,
  conversations: (tenantId: string) => ['conversations', tenantId] as const,
  messages: (conversationId: string) => ['conversations', conversationId, 'messages'] as const,
  runs: (conversationId: string) => ['conversations', conversationId, 'runs'] as const,
}
