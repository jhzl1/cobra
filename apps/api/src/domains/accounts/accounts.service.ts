import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { AuthError, PostgrestError } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'
import { PAGE_SIZE, type Page, type PlatformUser, type TemporaryPassword } from '@cobra/contracts'
import { rangeOfPage } from '~/common/pagination'
import { SupabaseService } from '~/supabase/supabase.service'

const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

/** How Supabase Auth itself writes "blocked until further notice": a century. */
const BLOCKED_FOR = '876000h'

/**
 * Every query here goes through the secret key, `unscoped`: accounts live in
 * `auth.users`, which no session reaches, and none of these tables belongs to a
 * tenant. The controller is what decides who may call each one.
 */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name)

  constructor(private readonly supabase: SupabaseService) {}

  async listUsers(page: number): Promise<Page<PlatformUser>> {
    const range = rangeOfPage(page)
    const rows = await this.selectUsers({ limit: PAGE_SIZE, offset: range.from })

    // A page past the end has no rows to carry the total, and the panel needs
    // it to move back to the last page.
    if (!rows.length && page > 1) {
      const [first] = await this.selectUsers({ limit: 1, offset: 0 })

      return { items: [], total: Number(first?.['total'] ?? 0) }
    }

    return { items: rows.map(toPlatformUser), total: Number(rows[0]?.['total'] ?? 0) }
  }

  async countOpenResetRequests(): Promise<{ count: number }> {
    const { count, error } = await this.supabase.unscoped
      .from('password_reset_requests')
      .select('id', { count: 'exact', head: true })
      .is('resolved_at', null)

    if (error) throw this.toHttpError(error)

    return { count: count ?? 0 }
  }

  /**
   * The account and the role in one step, so nobody is left holding a role
   * with no way to sign in — which is what granting by email used to do.
   */
  async createAdmin({
    email,
    issuedBy,
  }: {
    email: string
    issuedBy: string
  }): Promise<TemporaryPassword> {
    const account = await this.createAccount({ email, issuedBy })

    try {
      await this.grantAdmin({ email, userId: account.userId, issuedBy })
    } catch (failure) {
      await this.deleteAccount(account.userId)

      throw failure
    }

    return account.temporaryPassword
  }

  /**
   * A company's user: the account and its membership in one step. Also how a
   * company gets its first user, from `TenantsService.create`.
   */
  async createCompanyUser({
    tenantId,
    email,
    issuedBy,
  }: {
    tenantId: string
    email: string
    issuedBy: string
  }): Promise<TemporaryPassword> {
    const account = await this.createAccount({ email, issuedBy })

    const { error } = await this.supabase.unscoped
      .from('tenant_members')
      .insert({ tenant_id: tenantId, user_id: account.userId })

    if (error) {
      await this.deleteAccount(account.userId)

      if (error.code === FOREIGN_KEY_VIOLATION)
        throw new NotFoundException('No se encontró la empresa')

      throw this.toHttpError(error)
    }

    return account.temporaryPassword
  }

  /**
   * Revoking the role leaves the account with nothing — an administrator
   * belongs to no company — so the account is blocked too: it cannot sign in
   * again, and `AccountGuard` refuses the token it still holds.
   *
   * Blocked before the role is marked revoked. The other order, failing in
   * between, would leave an account with no role that can still sign in; this
   * one leaves a blocked administrator, and revoking again finishes the job.
   */
  async revokeAdmin({
    grantId,
    revokedBy,
  }: {
    grantId: string
    revokedBy: string
  }): Promise<{ revokedAt: string }> {
    const { data: grant, error } = await this.supabase.unscoped
      .from('user_roles')
      .select('id, user_id')
      .eq('id', grantId)
      .is('revoked_at', null)
      .maybeSingle()

    if (error) throw this.toHttpError(error)
    if (!grant) throw new NotFoundException('No se encontró un rol activo con ese identificador')

    const userId = grant.user_id as string | null

    if (userId === revokedBy) {
      throw new ConflictException(
        'No puedes revocar tu propio rol: tu cuenta quedaría bloqueada. Pídeselo a otro administrador.',
      )
    }

    if (userId) {
      const { error: blockError } = await this.supabase.unscoped.auth.admin.updateUserById(userId, {
        ban_duration: BLOCKED_FOR,
      })

      if (blockError) throw this.toAuthHttpError(blockError)
    }

    const revokedAt = new Date().toISOString()

    const { error: revokeError } = await this.supabase.unscoped
      .from('user_roles')
      .update({ revoked_at: revokedAt })
      .eq('id', grantId)

    if (revokeError) throw this.toHttpError(revokeError)

    return { revokedAt }
  }

  /**
   * What an administrator does with a reset request, or for anyone who asks in
   * person: a new password, shown once, that the person has to replace.
   *
   * The open request is resolved here, with who resolved it, whether or not
   * this was prompted by one.
   */
  async issueTemporaryPassword({
    userId,
    issuedBy,
  }: {
    userId: string
    issuedBy: string
  }): Promise<TemporaryPassword> {
    const password = generateTemporaryPassword()

    const { data, error } = await this.supabase.unscoped.auth.admin.updateUserById(userId, {
      password,
    })

    if (error?.code === 'user_not_found') throw new NotFoundException('No se encontró la cuenta')
    if (error) throw this.toAuthHttpError(error)

    await this.recordTemporaryPassword({ userId, issuedBy })

    const { error: resolveError } = await this.supabase.unscoped
      .from('password_reset_requests')
      .update({ resolved_at: new Date().toISOString(), resolved_by: issuedBy })
      .eq('user_id', userId)
      .is('resolved_at', null)

    if (resolveError) throw this.toHttpError(resolveError)

    return { email: data.user.email ?? '', password }
  }

  /**
   * Through the secret key and not `auth.updateUser` from the browser: that
   * call cannot clear the temporary-password mark, and the project's
   * "secure password change" setting would ask a person who just signed in
   * with a temporary password to sign in again first.
   */
  async changePassword({
    userId,
    password,
  }: {
    userId: string
    password: string
  }): Promise<{ changedAt: string }> {
    const { error } = await this.supabase.unscoped.auth.admin.updateUserById(userId, { password })

    if (error?.code === 'same_password') {
      throw new BadRequestException('La nueva contraseña debe ser distinta de la actual')
    }
    if (error?.code === 'weak_password') {
      throw new BadRequestException(
        'La contraseña es muy débil. Combina mayúsculas, minúsculas, números y símbolos.',
      )
    }
    if (error) throw this.toAuthHttpError(error)

    const changedAt = new Date().toISOString()

    const { error: replaceError } = await this.supabase.unscoped
      .from('temporary_passwords')
      .update({ replaced_at: changedAt })
      .eq('user_id', userId)
      .is('replaced_at', null)

    if (replaceError) throw this.toHttpError(replaceError)

    return { changedAt }
  }

  /** Records the request only if the email has an account; see the SQL function. */
  async requestPasswordReset(email: string): Promise<{ received: true }> {
    const { error } = await this.supabase.unscoped.rpc('request_password_reset', {
      requested_email: email,
    })

    if (error) throw this.toHttpError(error)

    return { received: true }
  }

  /**
   * An account with a temporary password, and no access yet: every caller
   * attaches one, and deletes the account if that fails. An account with no
   * access would be blocked by the next request anyway, so leaving it behind
   * only leaves an email nobody can reuse.
   *
   * An email that already has an account is refused rather than reused: its
   * owner already has a password and a kind of access, and an account is one
   * kind or the other.
   */
  private async createAccount({
    email,
    issuedBy,
  }: {
    email: string
    issuedBy: string
  }): Promise<{ userId: string; temporaryPassword: TemporaryPassword }> {
    const password = generateTemporaryPassword()

    const { data, error } = await this.supabase.unscoped.auth.admin.createUser({
      email,
      password,
      // Nobody receives a confirmation email: the administrator vouches for the
      // address by creating it.
      email_confirm: true,
    })

    if (error?.code === 'email_exists') {
      throw new ConflictException(
        'Ese correo ya tiene una cuenta en Wispay. Si olvidó su contraseña, restablécela desde la lista de usuarios.',
      )
    }

    if (error) throw this.toAuthHttpError(error)

    const userId = data.user.id

    try {
      await this.recordTemporaryPassword({ userId, issuedBy })
    } catch (failure) {
      await this.deleteAccount(userId)

      throw failure
    }

    return { userId, temporaryPassword: { email: data.user.email ?? email, password } }
  }

  private async deleteAccount(userId: string): Promise<void> {
    const { error } = await this.supabase.unscoped.auth.admin.deleteUser(userId)

    // The original failure is the one the administrator needs to read; this one
    // goes to the log, with the id, so the account can be removed by hand.
    if (error) this.logger.error(`Could not undo account ${userId}: ${error.code ?? error.message}`)
  }

  private async selectUsers({
    limit,
    offset,
  }: {
    limit: number
    offset: number
  }): Promise<Record<string, unknown>[]> {
    const { data, error } = await this.supabase.unscoped.rpc('platform_users', {
      page_size: limit,
      page_offset: offset,
    })

    if (error) throw this.toHttpError(error)

    return (data ?? []) as Record<string, unknown>[]
  }

  /**
   * A grant left from before accounts were created here — by email, with no
   * account behind it — was already tied to this account by the trigger on
   * `auth.users`, and inserting another would collide with it. That one is
   * the grant.
   */
  private async grantAdmin({
    email,
    userId,
    issuedBy,
  }: {
    email: string
    userId: string
    issuedBy: string
  }): Promise<void> {
    const { error } = await this.supabase.unscoped
      .from('user_roles')
      .insert({ email, role: 'ADMIN', user_id: userId, granted_by: issuedBy })

    if (error && error.code !== UNIQUE_VIOLATION) throw this.toHttpError(error)
  }

  /** One active temporary password per account: the previous one, if any, is replaced. */
  private async recordTemporaryPassword({
    userId,
    issuedBy,
  }: {
    userId: string
    issuedBy: string
  }): Promise<void> {
    const { error: replaceError } = await this.supabase.unscoped
      .from('temporary_passwords')
      .update({ replaced_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('replaced_at', null)

    if (replaceError) throw this.toHttpError(replaceError)

    const { error } = await this.supabase.unscoped
      .from('temporary_passwords')
      .insert({ user_id: userId, issued_by: issuedBy })

    if (error) throw this.toHttpError(error)
  }

  private toHttpError(error: PostgrestError): Error {
    this.logger.error(`Postgrest ${error.code}: ${error.message}`)

    return new InternalServerErrorException('No fue posible completar la operación')
  }

  // The message from Supabase Auth is English and says nothing the
  // administrator can act on; the code is what goes to the log.
  private toAuthHttpError(error: AuthError): Error {
    this.logger.error(`Auth ${error.code ?? error.status}: ${error.message}`)

    return new InternalServerErrorException(
      'No fue posible completar la operación con la cuenta. Inténtalo de nuevo.',
    )
  }
}

const toPlatformUser = (row: Record<string, unknown>): PlatformUser => ({
  userId: row['user_id'] as string,
  email: (row['email'] as string | null) ?? null,
  createdAt: row['created_at'] as string,
  lastSignInAt: (row['last_sign_in_at'] as string | null) ?? null,
  adminGrantId: (row['admin_grant_id'] as string | null) ?? null,
  companies: (row['companies'] as PlatformUser['companies'] | null) ?? [],
  resetRequestedAt: (row['reset_requested_at'] as string | null) ?? null,
  mustChangePassword: row['must_change_password'] === true,
  isBlocked: row['is_blocked'] === true,
})

/**
 * Read aloud or typed from a phone, so the characters that look alike (0 and O,
 * 1, l and I) are left out. One of each kind is guaranteed, whatever the
 * project's password policy asks for, and `randomInt` is the CSPRNG — not
 * `Math.random`.
 */
const LOWER = 'abcdefghjkmnpqrstuvwxyz'
const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const ALL = LOWER + UPPER + DIGITS
const TEMPORARY_PASSWORD_LENGTH = 14

const pickFrom = (alphabet: string): string => alphabet.charAt(randomInt(alphabet.length))

const generateTemporaryPassword = (): string => {
  const characters = [pickFrom(LOWER), pickFrom(UPPER), pickFrom(DIGITS)]

  while (characters.length < TEMPORARY_PASSWORD_LENGTH) characters.push(pickFrom(ALL))

  // Fisher–Yates, so the guaranteed three are not always the first three.
  for (let index = characters.length - 1; index > 0; index--) {
    const swapWith = randomInt(index + 1)
    const current = characters[index] as string

    characters[index] = characters[swapWith] as string
    characters[swapWith] = current
  }

  return characters.join('')
}
