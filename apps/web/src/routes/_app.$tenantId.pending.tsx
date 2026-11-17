import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { heldReceiptsSearchSchema } from '~/lib/searchSchemas'
import { TenantPendingPage } from '~/pages/Tenant/TenantPendingPage'

export const Route = createFileRoute('/_app/$tenantId/pending')({
  search: { middlewares: [stripSearchParams({ page: 1, status: 'open' })] },
  validateSearch: heldReceiptsSearchSchema,
  component: TenantPendingPage,
})
