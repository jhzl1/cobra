import { UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { withSupabase } from '@supabase/server/adapters/nestjs'
import { PlatformAdminGuard } from './platform-admin.guard'

const FORBIDDEN = 'No tienes permisos para esta acción'

/**
 * Restricts a route to whoever administers the platform.
 *
 * Both guards go into a single `UseGuards`, and that is not tidiness: Nest
 * appends to the handler's guard array and TypeScript applies method decorators
 * bottom-up, so two separate `UseGuards` land in the reverse of the order they
 * are read in. The role guard running before the token is verified finds no
 * `supabaseContext` and answers 403 to everyone, an administrator included.
 *
 * `@AuthClient()` is therefore not applied beside this one — it travels inside.
 */
export const RequireAdmin = () =>
  applyDecorators(
    UseGuards(withSupabase({ auth: 'user' }), PlatformAdminGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'La sesión no es válida o expiró' }),
    ApiForbiddenResponse({ description: FORBIDDEN }),
  )
