import { createFileRoute, notFound } from '@tanstack/react-router'
import { tenantsQueryOptions } from '~/fetchers/queries/tenantsQueryOptions'
import { saveLastTenantId } from '~/utils/lastTenant'

/**
 * Every company screen goes through here, so none of them has to check that
 * the company in the path is one this account reaches. An id that is not in
 * the list — mistyped, or a membership since revoked — is a not-found screen
 * instead of an empty panel.
 *
 * It decides what is drawn, nothing more: the API and RLS refuse a company the
 * account does not belong to whatever the panel shows.
 *
 * `staleTime: 'static'` reads the list from the cache when there is one, so moving
 * between a company's screens never waits on the network; the frame's own
 * query keeps that list fresh in the background.
 */
export const Route = createFileRoute('/_app/$tenantId')({
  beforeLoad: async ({ context, params }) => {
    const tenants = await context.queryClient.query({
      ...tenantsQueryOptions(),
      staleTime: 'static',
    })
    const isReachable = tenants.some((tenant) => tenant.id === params.tenantId)

    if (!isReachable) throw notFound()

    saveLastTenantId(params.tenantId)
  },
})
