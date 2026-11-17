import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Request } from 'express'
import { SupabaseService } from '~/supabase/supabase.service'

/** The panel reads these codes: the first signs the person out, the second sends them to replace their password. */
export const ACCOUNT_WITHOUT_ACCESS = 'ACCOUNT_WITHOUT_ACCESS'
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED'

const ALLOWS_TEMPORARY_PASSWORD = 'allowsTemporaryPassword'

/** Marks the routes an account on a temporary password still needs to get out of it. */
export const AllowTemporaryPassword = () => SetMetadata(ALLOWS_TEMPORARY_PASSWORD, true)

interface RequestWithSupabase extends Request {
  supabaseContext?: {
    userClaims?: { id?: string } | null
    jwtClaims?: { sub?: string } | null
  }
}

interface AccountAccess {
  hasAccess: boolean
  mustChangePassword: boolean
}

/**
 * Whether the account behind a valid token may still use the API.
 *
 * A token outlives the access it was issued for by up to an hour. Revoking an
 * administrator blocks the account in Supabase Auth, which stops new sign-ins
 * and refreshes, but the token already in the browser keeps verifying. This is
 * what makes it stop now: no role and no company answers 401, and the panel
 * signs out on a 401.
 *
 * An account on a temporary password answers 403 everywhere except the routes
 * marked `AllowTemporaryPassword`: whoever issued that password read it on
 * screen, so until it is replaced the account is as much theirs as its owner's.
 *
 * Runs after `withSupabase`, inside the same `UseGuards`, because it needs the
 * verified caller that guard leaves on the request.
 */
@Injectable()
export class AccountGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSupabase>()
    const userId =
      request.supabaseContext?.userClaims?.id ?? request.supabaseContext?.jwtClaims?.sub

    // No caller means `withSupabase` let an anonymous request through, which is
    // its decision to make, not this guard's.
    if (!userId) return true

    const access = await readAccountAccess(this.supabase.unscoped, userId)

    if (!access.hasAccess) {
      throw new UnauthorizedException({
        message: 'Tu cuenta ya no tiene acceso a Wispay.',
        code: ACCOUNT_WITHOUT_ACCESS,
      })
    }

    const allowsTemporaryPassword = this.reflector.getAllAndOverride<boolean>(
      ALLOWS_TEMPORARY_PASSWORD,
      [context.getHandler(), context.getClass()],
    )

    if (access.mustChangePassword && !allowsTemporaryPassword) {
      throw new ForbiddenException({
        message: 'Cambia tu contraseña temporal para continuar.',
        code: PASSWORD_CHANGE_REQUIRED,
      })
    }

    return true
  }
}

/**
 * Shared with the identity endpoint, so the screen and the gate can only ever
 * agree on who has to change their password.
 *
 * A failed read refuses rather than lets through: answering "has access"
 * because the database did not answer would open the account.
 */
export const readAccountAccess = async (
  client: SupabaseClient,
  userId: string,
): Promise<AccountAccess> => {
  const { data, error } = await client
    .rpc('account_access', { target_user: userId })
    .maybeSingle<{ has_access: boolean; must_change_password: boolean }>()

  if (error) throw new InternalServerErrorException('No fue posible verificar tu sesión')

  return {
    hasAccess: data?.has_access === true,
    mustChangePassword: data?.must_change_password === true,
  }
}
