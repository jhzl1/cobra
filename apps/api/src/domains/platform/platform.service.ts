import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { PostgrestError } from '@supabase/supabase-js'
import type { GrantRoleInput, PlatformIdentity, RoleGrant } from '@cobra/contracts'
import { SupabaseService } from '~/supabase/supabase.service'

const UNIQUE_VIOLATION = '23505'

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name)

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * What the panel asks for on load.
   *
   * Answered from the table so the screen and the server can only ever agree: a
   * panel that decided from the token would draw the platform section for
   * someone revoked minutes ago and then get a 403 on every click.
   */
  async identity(userId: string, email: string | null): Promise<PlatformIdentity> {
    const { data, error } = await this.supabase.admin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'ADMIN')
      .is('revoked_at', null)
      .maybeSingle()

    if (error) throw this.toHttpError(error)

    return { userId, email, isPlatformAdmin: !!data }
  }

  /** Every grant, active and revoked. The history is the point of this table. */
  async listGrants(): Promise<RoleGrant[]> {
    const { data, error } = await this.supabase.admin
      .from('user_roles')
      .select('id, email, role, user_id, granted_at, revoked_at')
      .order('granted_at', { ascending: false })

    if (error) throw this.toHttpError(error)

    return (data ?? []).map((row) => ({
      id: row.id as string,
      email: row.email as string,
      role: row.role as RoleGrant['role'],
      userId: (row.user_id as string | null) ?? null,
      grantedAt: row.granted_at as string,
      revokedAt: (row.revoked_at as string | null) ?? null,
    }))
  }

  /**
   * Grants by email, which is how someone can be authorised before they have an
   * account: a trigger ties the grant to the identity on their first sign-in.
   */
  async grant(grantedBy: string, input: GrantRoleInput): Promise<RoleGrant> {
    const { data, error } = await this.supabase.admin
      .from('user_roles')
      .insert({ email: input.email, role: input.role, granted_by: grantedBy })
      .select('id, email, role, user_id, granted_at, revoked_at')
      .single()

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictException('Esa persona ya tiene ese rol activo')
      }
      throw this.toHttpError(error)
    }

    // The grant may have arrived after the account existed, in which case the
    // trigger on auth.users already fired and will never fire again.
    await this.linkExistingUser(input.email)

    return {
      id: data.id as string,
      email: data.email as string,
      role: data.role as RoleGrant['role'],
      userId: (data.user_id as string | null) ?? null,
      grantedAt: data.granted_at as string,
      revokedAt: null,
    }
  }

  /** Revoking marks the row; it never deletes it. */
  async revoke(grantId: string): Promise<{ revokedAt: string }> {
    const revokedAt = new Date().toISOString()

    const { data, error } = await this.supabase.admin
      .from('user_roles')
      .update({ revoked_at: revokedAt })
      .eq('id', grantId)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle()

    if (error) throw this.toHttpError(error)
    if (!data) throw new NotFoundException('No se encontró una concesión activa con ese id')

    return { revokedAt }
  }

  private async linkExistingUser(email: string): Promise<void> {
    const { data } = await this.supabase.admin.auth.admin.listUsers()
    const user = data?.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    )

    if (!user) return

    await this.supabase.admin
      .from('user_roles')
      .update({ user_id: user.id })
      .eq('email', email.toLowerCase())
      .is('user_id', null)
  }

  private toHttpError(error: PostgrestError): Error {
    this.logger.error(`Postgrest ${error.code}: ${error.message}`)

    return new InternalServerErrorException('No se pudo completar la operación')
  }
}
