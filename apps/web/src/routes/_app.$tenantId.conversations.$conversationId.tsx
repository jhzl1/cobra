import { createFileRoute } from '@tanstack/react-router'
import { TenantConversationsPage } from '~/pages/Tenant/TenantConversationsPage'
import { conversationsSearchSchema } from '~/pages/Tenant/TenantConversationsPage/searchSchemas'

/** The conversation lives in the path: that is the link people send each other. */
export const Route = createFileRoute('/_app/$tenantId/conversations/$conversationId')({
  validateSearch: conversationsSearchSchema,
  component: TenantConversationsPage,
})
