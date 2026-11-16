import { createFileRoute } from '@tanstack/react-router'
import { TenantSetupPage } from '~/pages/Tenant/TenantSetupPage'

export const Route = createFileRoute('/_app/$tenantId/setup')({
  component: TenantSetupPage,
})
