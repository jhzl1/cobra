import { UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { withSupabase } from '@supabase/server/adapters/nestjs'
import { AccountGuard, AllowTemporaryPassword } from './account.guard'

/**
 * Marks a route as client-authenticated: verifies the Supabase access token and
 * documents the requirement in Swagger. Bundled so a route can never end up
 * guarded but undocumented, or documented but unguarded.
 *
 * The token being valid is not enough: the account behind it has to still have
 * access, and not be on a temporary password. See `AccountGuard`. Both guards
 * go in one `UseGuards` so they run in the order they are read — the reason is
 * on `RequirePlatformAdmin`.
 */
export const RequireSession = () =>
  applyDecorators(
    UseGuards(withSupabase({ auth: 'user' }), AccountGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'La sesión no es válida, expiró o la cuenta no tiene acceso',
    }),
    ApiForbiddenResponse({ description: 'La cuenta debe cambiar su contraseña temporal' }),
  )

/**
 * A session, even one still on a temporary password.
 *
 * Only for what that person needs to get out of it: knowing who they are, and
 * replacing the password. Anything else behind this decorator is reachable with
 * a password an administrator has read.
 */
export const RequireSessionAllowingTemporaryPassword = () =>
  applyDecorators(RequireSession(), AllowTemporaryPassword())
