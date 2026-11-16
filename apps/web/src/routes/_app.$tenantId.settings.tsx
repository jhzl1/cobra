import { createFileRoute } from '@tanstack/react-router'
import { TenantSettingsPage } from '~/pages/Tenant/TenantSettingsPage'

export const Route = createFileRoute('/_app/$tenantId/settings')({
  component: TenantSettingsPage,
})
