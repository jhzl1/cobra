import { createFileRoute, redirect } from '@tanstack/react-router'
import { platformIdentityQueryOptions } from '~/fetchers/queries/platformIdentityQueryOptions'
import { supabase } from '~/lib/supabase'
import { ChangePasswordPage } from '~/pages/ChangePasswordPage'

/**
 * Outside `/_app` on purpose: that layout sends an account on a temporary
 * password here, and its header loads the inbox, which the API refuses to that
 * account. A screen of its own has nothing to refuse.
 */
export const Route = createFileRoute('/change-password')({
  beforeLoad: async ({ location, context }) => {
    const { data } = await supabase.auth.getSession()

    if (!data.session) throw redirect({ to: '/login', search: { redirect: location.href } })

    // Whether the change is forced decides what the page offers, so it is
    // known before the page draws.
    await context.queryClient.query(platformIdentityQueryOptions())
  },
  component: ChangePasswordPage,
})
