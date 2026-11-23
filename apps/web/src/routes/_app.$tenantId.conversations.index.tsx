import { createFileRoute } from '@tanstack/react-router'
import { TenantConversationsPage } from '~/pages/Tenant/TenantConversationsPage'
import { conversationsSearchSchema } from '~/pages/Tenant/TenantConversationsPage/searchSchemas'

export const Route = createFileRoute('/_app/$tenantId/conversations/')({
  validateSearch: conversationsSearchSchema,
  component: TenantConversationsPage,
})
