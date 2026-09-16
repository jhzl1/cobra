import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common'
import type { Request } from 'express'
import { SupabaseService } from '~/supabase/supabase.service'

interface RequestWithSupabase extends Request {
  supabaseContext?: {
    userClaims?: { id?: string } | null
    jwtClaims?: { sub?: string } | null
  }
}

/**
 * Lets a route through only for whoever administers the platform.
 *
 * It asks the table, not the token's `roles` claim. An access token lives up to
 * an hour, so a claim can still say ADMIN for someone revoked five minutes ago —
 * and what this gate protects is the creation of companies and the granting of
 * this very role.
 *
 * The claim exists anyway, stamped by `custom_access_token_hook`, but nothing
 * here depends on that hook having been switched on.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSupabase>()
    const userId =
      request.supabaseContext?.userClaims?.id ?? request.supabaseContext?.jwtClaims?.sub

    if (!userId) throw new ForbiddenException('No tienes permisos para esta acción')

    if (!(await this.isAdmin(userId))) {
      throw new ForbiddenException('No tienes permisos para esta acción')
    }

    return true
  }

  private async isAdmin(userId: string): Promise<boolean> {
    const { data } = await this.supabase.admin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'ADMIN')
      .is('revoked_at', null)
      .maybeSingle()

    return !!data
  }
}
