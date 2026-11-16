import { useQuery } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { tenantsQueryOptions } from '~/fetchers/queries/tenantsQueryOptions'

/**
 * The company in the path, or null when there is none or this account does
 * not reach it.
 *
 * Read loosely because the frame and the inbox sit above `/$tenantId`, and the
 * platform screens have no company. Its refetch is also what keeps the list
 * the `/$tenantId` guard reads fresh.
 */
export const useCurrentTenantQuery = () => {
  const { tenantId } = useParams({ strict: false })

  return useQuery({
    ...tenantsQueryOptions(),
    select: (tenants) => tenants.find((tenant) => tenant.id === tenantId) ?? null,
  })
}
