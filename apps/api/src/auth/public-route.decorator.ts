import { UseGuards } from '@nestjs/common'
import { withSupabase } from '@supabase/server/adapters/nestjs'

/**
 * Reachable with no session at all. `auth: 'none'` skips the credential check;
 * it grants the route no privilege of its own.
 *
 * There are two, both on the WhatsApp webhook, and what authenticates them is
 * the opaque token in their path plus Meta's signature over the body.
 */
export const PublicRoute = () => UseGuards(withSupabase({ auth: 'none' }))
