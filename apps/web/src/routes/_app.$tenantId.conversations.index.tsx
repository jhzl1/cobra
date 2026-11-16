import { createFileRoute } from '@tanstack/react-router'
import { TenantConversationsPage } from '~/pages/Tenant/TenantConversationsPage'

export const Route = createFileRoute('/_app/$tenantId/conversations/')({
  component: TenantConversationsPage,
})
