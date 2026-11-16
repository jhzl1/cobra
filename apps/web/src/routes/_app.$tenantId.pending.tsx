import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { paginationSearchSchema } from '~/lib/searchSchemas'
import { TenantPendingPage } from '~/pages/Tenant/TenantPendingPage'

export const Route = createFileRoute('/_app/$tenantId/pending')({
  search: { middlewares: [stripSearchParams({ page: 1 })] },
  validateSearch: paginationSearchSchema,
  component: TenantPendingPage,
})
