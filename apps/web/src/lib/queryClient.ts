import { QueryClient } from '@tanstack/react-query'
import type { HeldReceiptStatus } from '@cobra/contracts'

// Each list's pages share its prefix, so invalidating the prefix reaches all of them.
const PLATFORM_ERRORS = ['platform', 'errors'] as const
const PLATFORM_LEADS = ['platform', 'leads'] as const
const PLATFORM_TENANTS = ['platform', 'tenant-pages'] as const
const PLATFORM_USERS = ['platform', 'users'] as const

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
  platformIdentity: ['platform', 'me'] as const,
  // Every page and the request count share the prefix: issuing a password or
  // creating an account changes both.
  platformUsers: PLATFORM_USERS,
  platformUserPage: (page: number) => [...PLATFORM_USERS, 'page', page] as const,
  openResetRequestCount: [...PLATFORM_USERS, 'open-reset-requests'] as const,
  platformSettings: ['platform', 'settings'] as const,
  modelCatalog: ['platform', 'models'] as const,
  tenants: ['tenants'] as const,
  tenant: (tenantId: string) => ['tenants', tenantId, 'detail'] as const,
  setup: (tenantId: string) => ['tenants', tenantId, 'setup'] as const,
  members: (tenantId: string) => ['tenants', tenantId, 'members'] as const,
  credentials: (tenantId: string) => ['tenants', tenantId, 'credentials'] as const,
  whatsappNumbers: (tenantId: string) => ['tenants', tenantId, 'numbers'] as const,
  wisphubPaymentMethods: (tenantId: string) =>
    ['tenants', tenantId, 'wisphub', 'payment-methods'] as const,
  wisphubZones: (tenantId: string) => ['tenants', tenantId, 'wisphub', 'zones'] as const,
  paymentMethods: (tenantId: string) => ['tenants', tenantId, 'payment-methods'] as const,
  // Every page shares the prefix, so invalidating `heldReceipts` reaches all of them.
  heldReceipts: (tenantId: string) => ['tenants', tenantId, 'held-receipts'] as const,
  paymentPage: ({
    tenantId,
    page,
    from,
    to,
  }: {
    tenantId: string
    page: number
    from: string
    to: string
  }) => ['tenants', tenantId, 'payments', from, to, page] as const,
  heldReceiptPage: ({
    tenantId,
    status,
    page,
  }: {
    tenantId: string
    status: HeldReceiptStatus
    page: number
  }) => ['tenants', tenantId, 'held-receipts', status, page] as const,
  // Under the held receipts' prefix, so applying or dismissing one refreshes it too.
  openHeldReceiptCount: (tenantId: string) =>
    ['tenants', tenantId, 'held-receipts', 'open-count'] as const,
  conversations: (tenantId: string) => ['conversations', tenantId] as const,
  // Under the inbox's prefix, so the live updates that refresh it refresh this too.
  conversationSearch: (tenantId: string, search: string) =>
    ['conversations', tenantId, 'search', search] as const,
  // Under the conversations' prefix, so a broadcast about one refreshes it.
  conversation: (conversationId: string) => ['conversations', conversationId, 'summary'] as const,
  messages: (conversationId: string) => ['conversations', conversationId, 'messages'] as const,
  runs: (conversationId: string) => ['conversations', conversationId, 'runs'] as const,
  jobRuns: (tenantId: string, onlyErrors: boolean) =>
    ['platform', 'tenants', tenantId, 'job-runs', onlyErrors] as const,
  platformErrorPage: (page: number) => [...PLATFORM_ERRORS, page] as const,
  platformLeads: PLATFORM_LEADS,
  platformLeadPage: (page: number) => [...PLATFORM_LEADS, page] as const,
  platformTenantPage: (page: number) => [...PLATFORM_TENANTS, page] as const,
}

/**
 * After a company is created or changes state. The whole list feeds the
 * company switcher and every panel's composer; the pages feed the platform's
 * table. `exact` so it does not refetch every company's detail as well.
 */
export const invalidateTenantLists = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.tenants, exact: true }),
    client.invalidateQueries({ queryKey: PLATFORM_TENANTS }),
  ])
