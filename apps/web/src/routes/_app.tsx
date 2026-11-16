import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppLayout } from '~/components/AppLayout'
import { supabase } from '~/lib/supabase'

/**
 * Every signed-in screen sits under this layout, so no route needs a session
 * check of its own. Signed out, any of them sends to the login, which brings
 * the person back here afterwards.
 *
 * `getSession()` reads the stored session and refreshes it when it is close to
 * expiring, so this does not reach the network on every navigation.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession()

    if (!data.session) throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  component: AppLayout,
})
