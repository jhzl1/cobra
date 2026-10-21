import { Navigate, createFileRoute } from '@tanstack/react-router'
import { PageSpinner } from '~/components/PageSpinner'
import { usePlatformIdentity } from '~/hooks/usePlatformIdentity'
import { readLastTenantId } from '~/lib/tenants'
import { useTenant } from '~/providers/TenantProvider'

export const Route = createFileRoute('/')({
  component: () => <Home />,
})

/**
 * `/` is not a screen: it sends each person to where they work.
 *
 * Back to the company opened last if it is still reachable, then the platform
 * for an administrator, then the first company on the list. Decided here and not
 * in `beforeLoad` because it needs the session, and the session only exists
 * inside the root's gate.
 */
const Home = () => {
  const { tenants, isLoading } = useTenant()
  const identity = usePlatformIdentity()

  if (isLoading || identity.isLoading) return <PageSpinner />

  const lastId = readLastTenantId()
  const last = tenants.find((tenant) => tenant.id === lastId)

  if (last) return <Navigate to="/$tenantId/conversations" params={{ tenantId: last.id }} replace />

  if (identity.data?.isPlatformAdmin) return <Navigate to="/platform" replace />

  const first = tenants[0]

  if (first)
    return <Navigate to="/$tenantId/conversations" params={{ tenantId: first.id }} replace />

  return <NoTenant />
}

/**
 * An account that belongs to no company yet. Only someone who is not an
 * administrator lands here — an administrator is sent to create one.
 */
const NoTenant = () => (
  <div className="flex flex-col items-start gap-2">
    <p className="text-sm text-muted-foreground">Todavía no hay ninguna empresa a tu nombre.</p>
    <p className="text-sm text-muted-foreground">
      Pídele a quien administra la plataforma que te agregue a una.
    </p>
  </div>
)
