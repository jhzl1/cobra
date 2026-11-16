import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { paymentRangeSearchSchema } from '~/lib/searchSchemas'
import { TenantPaymentsPage } from '~/pages/Tenant/TenantPaymentsPage'

export const Route = createFileRoute('/_app/$tenantId/payments')({
  search: { middlewares: [stripSearchParams({ page: 1 })] },
  validateSearch: paymentRangeSearchSchema,
  component: TenantPaymentsPage,
})
