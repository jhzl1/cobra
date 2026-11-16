import { createFileRoute, redirect } from '@tanstack/react-router'
import { platformIdentityQueryOptions } from '~/fetchers/queries/platformIdentityQueryOptions'
import { tenantsQueryOptions } from '~/fetchers/queries/tenantsQueryOptions'
import { NoTenantPage } from '~/pages/NoTenantPage'
import { readLastTenantId } from '~/utils/lastTenant'

/**
 * `/` is not a screen: it sends each person to where they work.
 *
 * Back to the company opened last if it is still reachable, then the platform
 * for an administrator, then the first company on the list. Only an account
 * that belongs to no company and administers nothing stays here.
 */
export const Route = createFileRoute('/_app/')({
  beforeLoad: async ({ context }) => {
    const [tenants, identity] = await Promise.all([
      context.queryClient.query(tenantsQueryOptions()),
      context.queryClient.query(platformIdentityQueryOptions()),
    ])
    const lastTenantId = readLastTenantId()
    const lastTenant = tenants.find((tenant) => tenant.id === lastTenantId)

    if (lastTenant) {
      throw redirect({
        to: '/$tenantId/conversations',
        params: { tenantId: lastTenant.id },
        replace: true,
      })
    }

    if (identity.isPlatformAdmin) throw redirect({ to: '/platform', replace: true })

    const firstTenant = tenants.at(0)

    if (firstTenant) {
      throw redirect({
        to: '/$tenantId/conversations',
        params: { tenantId: firstTenant.id },
        replace: true,
      })
    }
  },
  component: NoTenantPage,
})
