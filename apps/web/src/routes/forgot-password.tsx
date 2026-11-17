import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '~/lib/supabase'
import { ForgotPasswordPage } from '~/pages/ForgotPasswordPage'

export const Route = createFileRoute('/forgot-password')({
  // Someone signed in changes their password from the header instead.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()

    if (data.session) throw redirect({ to: '/', replace: true })
  },
  component: ForgotPasswordPage,
})
