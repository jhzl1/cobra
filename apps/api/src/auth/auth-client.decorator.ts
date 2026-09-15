import { UseGuards, applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger'
import { withSupabase } from '@supabase/server/adapters/nestjs'

/**
 * Marks a route as client-authenticated: verifies the Supabase access token and
 * documents the requirement in Swagger. Bundled so a route can never end up
 * guarded but undocumented, or documented but unguarded.
 */
export const AuthClient = () =>
  applyDecorators(
    UseGuards(withSupabase({ auth: 'user' })),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'La sesión no es válida o expiró' }),
  )
