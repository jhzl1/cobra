import { createFileRoute, redirect } from '@tanstack/react-router'
import { supabase } from '~/lib/supabase'
import { LandingPage } from '~/pages/LandingPage'
import { landingSearchSchema } from '~/pages/LandingPage/searchSchemas'

/**
 * The public landing page. It is open to everyone; a signed-in visitor sees it
 * too, with a way into the panel instead of the sign-in link.
 *
 * Google sign-in comes back to the site's origin, which is this route, with the
 * session in the URL. That visitor came to work, not to read the landing page,
 * so they continue to the panel. The callback URL stays the origin because it
 * is the one registered with Supabase; moving it would need that list changed
 * in every environment first.
 */
export const Route = createFileRoute('/')({
  validateSearch: landingSearchSchema,
  beforeLoad: async ({ location, search }) => {
    const isAuthCallback = location.hash.includes('access_token') || search.code !== undefined

    if (!isAuthCallback) return

    const { data } = await supabase.auth.getSession()

    if (data.session) throw redirect({ to: '/panel', replace: true })
  },
  loader: async () => {
    const { data } = await supabase.auth.getSession()

    return { isSignedIn: Boolean(data.session) }
  },
  component: LandingPage,
})
