import { z } from 'zod'

/**
 * Google sign-in with PKCE comes back to the origin with `?code=…`. Only its
 * presence matters to the route; anything unreadable is dropped rather than
 * failing the public page.
 */
export const landingSearchSchema = z.object({
  code: z.string().optional().catch(undefined),
})
