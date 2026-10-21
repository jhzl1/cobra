import { Outlet, createFileRoute } from '@tanstack/react-router'
import { PageSpinner } from '~/components/PageSpinner'
import { usePlatformIdentity } from '~/hooks/usePlatformIdentity'
import { NotFoundPage } from '~/pages/ErrorPage'

export const Route = createFileRoute('/_platform')({
  component: () => <PlatformAdminGate />,
})

/**
 * Every route outside `/$tenantId` belongs to the platform, and sits under this
 * layout so a new one cannot be added without the check.
 *
 * Someone who is not an administrator gets the not-found screen rather than a
 * refusal: there is nothing here for them to ask for. What is allowed is still
 * decided by the API, every time.
 */
const PlatformAdminGate = () => {
  const identity = usePlatformIdentity()

  if (identity.isLoading) return <PageSpinner />

  if (!identity.data?.isPlatformAdmin) return <NotFoundPage />

  return <Outlet />
}
