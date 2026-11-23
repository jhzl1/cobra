import { createFileRoute, redirect } from '@tanstack/react-router'
import { platformIdentityQueryOptions } from '~/fetchers/queries/platformIdentityQueryOptions'
import { tenantsQueryOptions } from '~/fetchers/queries/tenantsQueryOptions'
import { NoTenantPage } from '~/pages/NoTenantPage'
import { readLastTenantId } from '~/utils/lastTenant'

/**
 * `/panel` is not a screen: it sends each person to where they work. `/` is the
 * public landing page, so every "back to the panel" link and every post-login
 * redirect points here instead.
 *
 * An administrator always lands on the platform. They reach every company, so
 * the company opened last is always reachable too, and checking it first sent
 * them back into whichever company they had audited instead of to their panel.
 * Everyone else goes back to the company opened last if it is still reachable,
 * then to the first company on the list. Only an account that belongs to no
 * company and administers nothing stays here.
 */
export const Route = createFileRoute('/_app/panel')({
  beforeLoad: async ({ context }) => {
    const identity = await context.queryClient.query(platformIdentityQueryOptions())

    if (identity.isPlatformAdmin) throw redirect({ to: '/platform', replace: true })

    const tenants = await context.queryClient.query(tenantsQueryOptions())
    const lastTenantId = readLastTenantId()
    const lastTenant = tenants.find((tenant) => tenant.id === lastTenantId)

    if (lastTenant) {
      throw redirect({
        to: '/$tenantId/conversations',
        params: { tenantId: lastTenant.id },
        replace: true,
      })
    }

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
