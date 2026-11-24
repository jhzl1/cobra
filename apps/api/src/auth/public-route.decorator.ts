import { UseGuards } from '@nestjs/common'
import { withSupabase } from '@supabase/server/adapters/nestjs'

/**
 * Reachable with no session at all. `auth: 'none'` skips the credential check;
 * it grants the route no privilege of its own.
 *
 * There are three, and each carries its own protection:
 * - the WhatsApp webhook, authenticated by the opaque token in its path and
 *   nothing else — see `WhatsappController`;
 * - the password reset request, which answers the same whether the email has
 *   an account or not — see `AccountsController`;
 * - the demo request form, limited per IP and per hour — see `LeadsController`.
 */
export const PublicRoute = () => UseGuards(withSupabase({ auth: 'none' }))
