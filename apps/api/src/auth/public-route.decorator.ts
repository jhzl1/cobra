import { UseGuards } from '@nestjs/common'
import { withSupabase } from '@supabase/server/adapters/nestjs'

/**
 * Reachable with no session at all. `auth: 'none'` skips the credential check;
 * it grants the route no privilege of its own.
 *
 * There is one, the WhatsApp webhook, and what authenticates it is the opaque
 * token in its path and nothing else — see `WhatsappController`.
 */
export const PublicRoute = () => UseGuards(withSupabase({ auth: 'none' }))
