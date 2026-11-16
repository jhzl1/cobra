import { createRouter } from '@tanstack/react-router'
import { PageSpinner } from '~/components/PageSpinner'
import { queryClient } from '~/lib/queryClient'
import { supabase } from '~/lib/supabase'
import { ErrorPage } from '~/pages/ErrorPage'
import { NotFoundPage } from '~/pages/NotFoundPage'
import { routeTree } from '~/routeTree.gen'

/**
 * Routes live in `src/routes`, one file per route, and the Vite plugin writes
 * `routeTree.gen.ts` from them.
 *
 * Every signed-in route sits under `/_app`. Inside it the tree has two halves:
 * everything under `/$tenantId` is one company's panel, and everything else is
 * the platform's, for its administrators only.
 */
export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultNotFoundComponent: NotFoundPage,
  defaultErrorComponent: ErrorPage,
  defaultPendingComponent: PageSpinner,
})

// The guards run on navigation, so a sign-out — from the header, from another
// tab, or a refresh token that stopped working — has to run them again for the
// login to appear. The cache goes too: the guards trust it, and it still holds
// the previous account's companies.
//
// Deferred because Supabase deadlocks when its own auth callback waits on
// another auth call, and the guards call `getSession()`.
supabase.auth.onAuthStateChange((event) => {
  if (event !== 'SIGNED_OUT') return

  setTimeout(() => {
    queryClient.clear()
    void router.invalidate()
  }, 0)
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
