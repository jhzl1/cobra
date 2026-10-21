import { createRouter } from '@tanstack/react-router'
import { ErrorPage, NotFoundPage } from '~/pages/ErrorPage'
import { routeTree } from '~/routeTree.gen'

/**
 * Routes live in `src/routes`, one file per route, and the Vite plugin writes
 * `routeTree.gen.ts` from them.
 *
 * The tree has two halves: everything under `/$tenantId` is one company's panel,
 * and everything else is the platform's, for its administrators only.
 */
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
