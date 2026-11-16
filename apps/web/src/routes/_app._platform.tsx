import { createFileRoute, notFound } from '@tanstack/react-router'
import { platformIdentityQueryOptions } from '~/fetchers/queries/platformIdentityQueryOptions'

/**
 * Every route outside `/$tenantId` belongs to the platform, and sits under this
 * layout so a new one cannot be added without the check.
 *
 * Someone who is not an administrator gets the not-found screen rather than a
 * refusal: there is nothing here for them to ask for. What is allowed is still
 * decided by the API, every time.
 *
 * No screen keeps this answer fresh in the background, so it follows the
 * client's `staleTime`: a revoked administrator stops seeing the platform
 * within half a minute instead of at the next reload.
 */
export const Route = createFileRoute('/_app/_platform')({
  beforeLoad: async ({ context }) => {
    const identity = await context.queryClient.query(platformIdentityQueryOptions())

    if (!identity.isPlatformAdmin) throw notFound()
  },
})
