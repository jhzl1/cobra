import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '~/lib/supabase'
import { LoginPage } from '~/pages/LoginPage'
import { loginSearchSchema } from '~/pages/LoginPage/searchSchemas'

export const Route = createFileRoute('/login')({
  validateSearch: loginSearchSchema,
  // Someone already signed in has nothing to do here: back to where they were going.
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession()

    if (data.session) throw redirect({ href: search.redirect ?? '/panel', replace: true })
  },
  component: LoginPage,
})
