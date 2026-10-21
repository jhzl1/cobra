import { Outlet, createFileRoute } from '@tanstack/react-router'
import { PageSpinner } from '~/components/PageSpinner'
import { NotFoundPage } from '~/pages/ErrorPage'
import { useTenant } from '~/providers/TenantProvider'

export const Route = createFileRoute('/$tenantId')({
  component: () => <TenantGate />,
})

/**
 * Every company screen goes through here, so none of them has to check that the
 * company in the path is one this account reaches.
 *
 * It decides what is drawn, nothing more: the API and RLS refuse a company the
 * account does not belong to whatever the panel shows.
 */
const TenantGate = () => {
  const { tenantId, loading } = useTenant()

  if (loading) return <PageSpinner />

  if (!tenantId) return <NotFoundPage />

  return <Outlet />
}
