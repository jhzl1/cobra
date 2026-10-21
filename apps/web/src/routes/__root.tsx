import { createRootRoute } from '@tanstack/react-router'
import { AppLayout } from '~/components/AppLayout'
import { Spinner } from '~/components/ui/spinner'
import { LoginPage } from '~/pages/LoginPage'
import { InboxProvider } from '~/providers/InboxProvider'
import { SessionProvider, useSession } from '~/providers/SessionProvider'
import { TenantProvider } from '~/providers/TenantProvider'

export const Route = createRootRoute({
  component: () => (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  ),
})

/**
 * Signed out, every route is the login screen — the router never sees a
 * half-authenticated state, so no route needs a session guard of its own.
 */
const Gate = () => {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (!session) return <LoginPage />

  return (
    <TenantProvider>
      <InboxProvider>
        <AppLayout />
      </InboxProvider>
    </TenantProvider>
  )
}
