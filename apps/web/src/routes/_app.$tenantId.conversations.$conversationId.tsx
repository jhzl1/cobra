import { createFileRoute } from '@tanstack/react-router'
import { TenantConversationsPage } from '~/pages/Tenant/TenantConversationsPage'

/** The conversation lives in the path: that is the link people send each other. */
export const Route = createFileRoute('/_app/$tenantId/conversations/$conversationId')({
  component: TenantConversationsPage,
})
