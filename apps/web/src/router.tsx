import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useParams,
} from '@tanstack/react-router'
import { AppLayout, NoTenant } from '~/components/AppLayout'
import { Spinner } from '~/components/ui/spinner'
import { ErrorPage, NotFoundPage } from '~/pages/ErrorPage'
import { LoginPage } from '~/pages/LoginPage'
import { PlatformPage } from '~/pages/PlatformPage'
import { SettingsPage } from '~/pages/SettingsPage'
import { SetupPage } from '~/pages/SetupPage'
import { WorkspacePage } from '~/pages/WorkspacePage'
import { SessionProvider, useSession } from '~/providers/SessionProvider'
import { TenantProvider, useTenant } from '~/providers/TenantProvider'

/**
 * Routes are defined in code rather than by file convention.
 *
 * There are five of them and no lazy loading to arrange, so the generated route
 * tree and the Vite plugin that writes it would be machinery with nothing to
 * hold. The types are the same either way.
 */
const rootRoute = createRootRoute({
  component: () => (
    <SessionProvider>
      <Gate />
    </SessionProvider>
  ),
})

/**
 * Signed out, every route is the login screen — the router never sees a
 * half-authenticated state, so no route needs a guard of its own.
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
      <AppLayout />
    </TenantProvider>
  )
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/chats' })
  },
})

const chatsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chats',
  component: () => <Workspace />,
})

/** The conversation lives in the path: that is the link people send each other. */
const conversationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chats/$conversationId',
  component: () => <Workspace />,
})

const Workspace = () => {
  const { tenantId } = useTenant()
  const params = useParams({ strict: false }) as { conversationId?: string }

  if (!tenantId) return <NoTenant />

  return <WorkspacePage tenantId={tenantId} conversationId={params.conversationId ?? null} />
}

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  component: () => {
    const { tenantId } = useTenant()

    if (!tenantId) return <NoTenant />

    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SetupPage tenantId={tenantId} />
      </div>
    )
  },
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: () => {
    const { tenantId } = useTenant()

    if (!tenantId) return <NoTenant />

    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SettingsPage tenantId={tenantId} />
      </div>
    )
  },
})

const platformRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/platform',
  component: () => (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <PlatformPage />
    </div>
  ),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  chatsRoute,
  conversationRoute,
  setupRoute,
  settingsRoute,
  platformRoute,
])

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFoundPage,
  defaultErrorComponent: ({ error, reset }) => <ErrorPage error={error} reset={reset} />,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
