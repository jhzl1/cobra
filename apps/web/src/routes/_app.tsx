import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppLayout } from '~/components/AppLayout'
import { platformIdentityQueryOptions } from '~/fetchers/queries/platformIdentityQueryOptions'
import { supabase } from '~/lib/supabase'

/**
 * Every signed-in screen sits under this layout, so no route needs a session
 * check of its own. Signed out, any of them sends to the login, which brings
 * the person back here afterwards.
 *
 * `getSession()` reads the stored session and refreshes it when it is close to
 * expiring, so this does not reach the network on every navigation.
 *
 * An account on a temporary password goes to replace it first: the API refuses
 * it everything else, so any screen here would only show errors.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location, context }) => {
    const { data } = await supabase.auth.getSession()

    if (!data.session) throw redirect({ to: '/login', search: { redirect: location.href } })

    const identity = await context.queryClient.query(platformIdentityQueryOptions())

    if (identity.mustChangePassword) throw redirect({ to: '/change-password', replace: true })
  },
  component: AppLayout,
})
