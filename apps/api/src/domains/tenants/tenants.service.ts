import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import type {
  CreateTenantInput,
  CredentialStatus,
  PaymentMethodInput,
  RegisterWhatsappNumberInput,
  SaveCredentialInput,
  TenantMember,
  TenantSetup,
  TenantStatus,
  UpdateTenantInput,
} from '@cobra/contracts'
import { CredentialsCryptoService } from '~/crypto/credentials-crypto.service'
import { SupabaseService } from '~/supabase/supabase.service'

const UNIQUE_VIOLATION = '23505'

/** How many suffixed slugs to try before giving up. */
const SLUG_ATTEMPTS = 20

/** Without all three the agent cannot read, think or register a payment. */
const REQUIRED_PROVIDERS = ['meta', 'openrouter', 'wisphub'] as const

const PROVIDER_LABEL: Record<(typeof REQUIRED_PROVIDERS)[number], string> = {
  meta: 'WhatsApp Cloud API',
  openrouter: 'OpenRouter',
  wisphub: 'Wisphub',
}

const labelOf = (provider: (typeof REQUIRED_PROVIDERS)[number]): string => PROVIDER_LABEL[provider]

const TENANT_COLUMNS =
  'id, slug, company_name, support_phone, admin_phone, status, tenant_members(count)'

export interface Tenant {
  id: string
  slug: string
  companyName: string
  supportPhone: string
  adminPhone: string
  status: TenantStatus
  /** How many people belong to it. Zero means it is unreachable to everyone. */
  memberCount: number
}

export interface WhatsappNumber {
  id: string
  phoneNumberId: string
  displayNumber: string
  verifyToken: string
  /**
   * The complete URL to paste into Meta. Built here and not in the panel: the
   * panel knows the address it calls, which behind a tunnel is not the one Meta
   * has to reach.
   */
  webhookUrl: string
  validTo: string | null
}

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly crypto: CredentialsCryptoService,
  ) {}

  /**
   * The caller's tenants, filtered by RLS rather than by a where clause here.
   *
   * `tenant_members(count)` rides along on the same policy: a member counts the
   * company they belong to, an administrator counts every one.
   */
  async listMine(client: SupabaseClient): Promise<Tenant[]> {
    const { data, error } = await client
      .from('tenants')
      .select(TENANT_COLUMNS)
      .order('company_name')

    if (error) throw this.toHttpError(error)

    return data.map(toTenant)
  }

  /**
   * Who belongs to a company, for the platform's own view.
   *
   * The membership rows come from the table; the addresses come from auth, which
   * no policy reaches, so they are resolved one id at a time with the secret
   * key. `listUsers()` would page through every account in the project to find
   * three.
   */
  async listMembers(tenantId: string): Promise<TenantMember[]> {
    const { data, error } = await this.supabase.admin
      .from('tenant_members')
      .select('user_id, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at')

    if (error) throw this.toHttpError(error)

    return Promise.all(
      data.map(async (row) => {
        const { data: found } = await this.supabase.admin.auth.admin.getUserById(row.user_id)

        return {
          userId: row.user_id as string,
          email: found?.user?.email ?? null,
          joinedAt: row.created_at as string,
        }
      }),
    )
  }

  /**
   * Suspending stops the pipeline: the webhook drops that company's events and
   * the worker refuses to run a turn for it. Reactivating only restores that —
   * nothing that arrived while it was suspended is replayed.
   */
  async setStatus(tenantId: string, status: TenantStatus): Promise<Tenant> {
    const { data, error } = await this.supabase.admin
      .from('tenants')
      .update({ status })
      .eq('id', tenantId)
      .select(TENANT_COLUMNS)
      .single()

    if (error) throw this.toHttpError(error)

    return toTenant(data)
  }

  /**
   * Creating a tenant and joining it are one operation.
   *
   * It runs with the secret key because `tenants` has no insert policy: a
   * caller with no membership anywhere cannot pass a policy that asks for
   * membership. The caller's id comes from the verified token, never from the
   * body.
   */
  async create(userId: string, input: CreateTenantInput): Promise<Tenant> {
    const data = await this.insertWithDerivedSlug(input)

    const membership = await this.supabase.admin
      .from('tenant_members')
      .insert({ tenant_id: data.id, user_id: userId })

    if (membership.error) {
      // Without the membership the tenant is invisible to everyone, including
      // whoever just created it. Undo rather than leave it orphaned.
      await this.supabase.admin.from('tenants').delete().eq('id', data.id)
      throw this.toHttpError(membership.error)
    }

    // The count is stated rather than read: the membership above was inserted
    // after the row came back, so the aggregate would say zero.
    return { ...toTenant(data), memberCount: 1 }
  }

  async update(
    client: SupabaseClient,
    tenantId: string,
    input: UpdateTenantInput,
  ): Promise<Tenant> {
    const { data, error } = await client
      .from('tenants')
      .update({
        ...(input.companyName ? { company_name: input.companyName } : {}),
        ...(input.supportPhone ? { support_phone: input.supportPhone } : {}),
        ...(input.adminPhone ? { admin_phone: input.adminPhone } : {}),
      })
      .eq('id', tenantId)
      .select(TENANT_COLUMNS)
      .single()

    if (error) throw this.toHttpError(error)

    return toTenant(data)
  }

  /** What the panel is allowed to know about a credential: that it is loaded. */
  async listCredentials(client: SupabaseClient, tenantId: string): Promise<CredentialStatus[]> {
    const { data, error } = await client
      .from('tenant_credentials')
      .select('provider, last4, rotated_at')
      .eq('tenant_id', tenantId)

    if (error) throw this.toHttpError(error)

    return data.map((row) => ({
      provider: row.provider,
      last4: row.last4,
      rotatedAt: row.rotated_at,
    }))
  }

  /**
   * Saves a credential encrypted. The plaintext exists in this process and
   * nowhere else: it is never logged, never returned and never stored.
   */
  async saveCredential(
    userId: string,
    tenantId: string,
    input: SaveCredentialInput,
  ): Promise<CredentialStatus> {
    await this.assertMembership(userId, tenantId)

    const { ciphertext, last4 } = this.crypto.encrypt({ secret: input.secret, extra: input.extra })

    const { data, error } = await this.supabase.admin
      .from('tenant_credentials')
      .upsert(
        {
          tenant_id: tenantId,
          provider: input.provider,
          ciphertext,
          last4,
          rotated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,provider' },
      )
      .select('provider, last4, rotated_at')
      .single()

    if (error) throw this.toHttpError(error)

    return { provider: data.provider, last4: data.last4, rotatedAt: data.rotated_at }
  }

  async listNumbers(
    client: SupabaseClient,
    tenantId: string,
    publicUrl: string,
  ): Promise<WhatsappNumber[]> {
    const { data, error } = await client
      .from('whatsapp_numbers')
      .select('id, phone_number_id, display_number, verify_token, webhook_token, valid_to')
      .eq('tenant_id', tenantId)
      .order('valid_from', { ascending: false })

    if (error) throw this.toHttpError(error)

    const { data: tenant } = await client.from('tenants').select('slug').eq('id', tenantId).single()

    return data.map((row) => ({
      id: row.id,
      phoneNumberId: row.phone_number_id,
      displayNumber: row.display_number,
      verifyToken: row.verify_token,
      webhookUrl: `${publicUrl}/wh/wa/${tenant?.slug ?? ''}/${row.webhook_token}`,
      validTo: row.valid_to,
    }))
  }

  /**
   * Registers a number and mints its two tokens.
   *
   * `verify_token` is what Meta echoes in the GET handshake; `webhook_token` is
   * the opaque segment of the URL and is what authenticates an inbound POST
   * when a signature is unavailable. Both are generated here — never chosen by
   * the client — because their entropy is the whole protection.
   */
  async registerNumber(
    userId: string,
    tenantId: string,
    input: RegisterWhatsappNumberInput,
    publicUrl: string,
  ): Promise<WhatsappNumber> {
    await this.assertMembership(userId, tenantId)

    const { data, error } = await this.supabase.admin
      .from('whatsapp_numbers')
      .insert({
        tenant_id: tenantId,
        phone_number_id: input.phoneNumberId,
        display_number: input.displayNumber,
        verify_token: randomBytes(24).toString('base64url'),
        webhook_token: randomBytes(32).toString('base64url'),
      })
      .select('id, phone_number_id, display_number, verify_token, webhook_token, valid_to')
      .single()

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        // The index is global, so the collision may be here or somewhere else.
        // Saying "otra empresa" when it is already registered on this very
        // screen sends the operator looking for a company that has nothing to
        // do with it.
        throw new ConflictException(
          'Ese identificador ya está registrado y activo. Si es de esta empresa, está en la ' +
            'lista de arriba; dalo de baja antes de volver a registrarlo.',
        )
      }
      throw this.toHttpError(error)
    }

    const { data: tenant } = await this.supabase.admin
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .single()

    return {
      id: data.id,
      phoneNumberId: data.phone_number_id,
      displayNumber: data.display_number,
      verifyToken: data.verify_token,
      webhookUrl: `${publicUrl}/wh/wa/${tenant?.slug ?? ''}/${data.webhook_token}`,
      validTo: data.valid_to,
    }
  }

  /**
   * What is still missing before this company's bot answers anyone.
   *
   * Runs with the secret key because it counts rows across five tables to answer
   * one question, and a member who can read all of them individually gains
   * nothing from doing it here — the caller's access is checked before this.
   *
   * The webhook step is the only one nobody can complete from the panel: it is
   * done in Meta's dashboard, so the signal is the only honest one there is,
   * that something actually arrived through it.
   */
  async setup(userId: string, tenantId: string, publicUrl: string): Promise<TenantSetup> {
    await this.assertMembership(userId, tenantId)

    const [tenant, credentials, numbers, methods, inbound] = await Promise.all([
      this.supabase.admin.from('tenants').select('slug, status').eq('id', tenantId).single(),
      this.supabase.admin.from('tenant_credentials').select('provider').eq('tenant_id', tenantId),
      this.supabase.admin
        .from('whatsapp_numbers')
        .select('verify_token, webhook_token')
        .eq('tenant_id', tenantId)
        .is('valid_to', null)
        .order('valid_from', { ascending: false })
        .limit(1),
      this.supabase.admin
        .from('payment_methods')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      this.supabase.admin
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('direction', 'inbound'),
    ])

    if (tenant.error) throw this.toHttpError(tenant.error)

    const loaded = new Set((credentials.data ?? []).map((row) => row.provider as string))
    const missing = REQUIRED_PROVIDERS.filter((provider) => !loaded.has(provider))
    const number = numbers.data?.[0]

    const steps: TenantSetup['steps'] = [
      {
        id: 'credentials',
        done: missing.length === 0,
        pending: missing.length ? `Faltan ${missing.map(labelOf).join(' y ')}` : null,
      },
      {
        id: 'number',
        done: !!number,
        pending: number ? null : 'Todavía no hay ningún número conectado',
      },
      {
        id: 'webhook',
        done: (inbound.count ?? 0) > 0,
        pending:
          (inbound.count ?? 0) > 0 ? null : 'Todavía no ha llegado ningún mensaje por el webhook',
      },
      {
        id: 'paymentMethods',
        done: (methods.count ?? 0) > 0,
        pending:
          (methods.count ?? 0) > 0
            ? null
            : 'Sin cuentas, todo comprobante se retiene para revisión manual',
      },
    ]

    const slug = tenant.data.slug as string

    return {
      steps,
      status: tenant.data.status as TenantStatus,
      ready: steps.every((step) => step.done) && tenant.data.status === 'active',
      webhookUrl: number ? `${publicUrl}/wh/wa/${slug}/${number.webhook_token}` : null,
      verifyToken: (number?.verify_token as string | undefined) ?? null,
    }
  }

  async listPaymentMethods(client: SupabaseClient, tenantId: string) {
    const { data, error } = await client
      .from('payment_methods')
      .select('id, zone, entity_name, payment_address, wisphub_id, description')
      .eq('tenant_id', tenantId)
      .order('entity_name')

    if (error) throw this.toHttpError(error)

    return data
  }

  async addPaymentMethod(client: SupabaseClient, tenantId: string, input: PaymentMethodInput) {
    const { data, error } = await client
      .from('payment_methods')
      .insert({
        tenant_id: tenantId,
        zone: input.zone ?? null,
        entity_name: input.entityName,
        payment_address: input.paymentAddress,
        wisphub_id: input.wisphubId ?? null,
        description: input.description ?? null,
      })
      .select('id, zone, entity_name, payment_address, wisphub_id, description')
      .single()

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        throw new ConflictException('Esa cuenta ya está registrada para esta empresa')
      }
      throw this.toHttpError(error)
    }

    return data
  }

  /**
   * Takes a number out of service. The row stays.
   *
   * `whatsapp_numbers` is a validity table on purpose: a number that leaves one
   * company and is activated at another must not carry the first one's history
   * with it. Deleting the row would take the record of which number received
   * what along with it, and the partial unique index already frees the
   * `phone_number_id` the moment `valid_to` is set — which is what makes
   * registering it again work.
   */
  async retireNumber(client: SupabaseClient, tenantId: string, numberId: string) {
    const { error } = await client
      .from('whatsapp_numbers')
      .update({ valid_to: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('id', numberId)
      .is('valid_to', null)

    if (error) throw this.toHttpError(error)
  }

  async removePaymentMethod(client: SupabaseClient, tenantId: string, methodId: string) {
    const { error } = await client
      .from('payment_methods')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', methodId)

    if (error) throw this.toHttpError(error)
  }

  /**
   * Inserts the company, deriving its slug from its name.
   *
   * The slug is only ever seen inside the webhook URL, so nobody is asked to
   * invent one. Two companies can share a name, and the column is unique, so a
   * collision retries with a numeric suffix rather than failing in the face of
   * whoever is onboarding a client.
   */
  private async insertWithDerivedSlug(input: CreateTenantInput): Promise<Record<string, unknown>> {
    const base = slugify(input.companyName)

    for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt += 1) {
      const slug = attempt === 1 ? base : `${base}-${attempt}`

      const { data, error } = await this.supabase.admin
        .from('tenants')
        .insert({
          slug,
          company_name: input.companyName,
          support_phone: input.supportPhone,
          admin_phone: input.adminPhone,
        })
        .select('id, slug, company_name, support_phone, admin_phone, status')
        .single()

      if (!error) return data
      if (error.code !== UNIQUE_VIOLATION) throw this.toHttpError(error)
    }

    throw new ConflictException('Ya hay demasiadas empresas con un nombre parecido')
  }

  /**
   * The check RLS would have done, for the writes that run with the secret key.
   *
   * The service role ignores policies, so a route that skips this one answers
   * happily for a tenant the caller has nothing to do with.
   */
  async assertMembership(userId: string, tenantId: string): Promise<void> {
    const { data, error } = await this.supabase.admin
      .from('tenant_members')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw this.toHttpError(error)
    if (!data) throw new ForbiddenException('No tienes acceso a esta empresa')
  }

  private toHttpError(error: PostgrestError): Error {
    if (error.code === 'PGRST116') return new NotFoundException('No se encontró el recurso')

    this.logger.error(`Postgrest ${error.code}: ${error.message}`)

    return new InternalServerErrorException('No se pudo completar la operación')
  }
}

/**
 * A company name turned into a URL segment.
 *
 * `normalize('NFD')` splits an accented letter into the letter plus its mark, so
 * stripping the marks leaves ASCII behind — without it "Telecomunicación" loses
 * the whole last syllable instead of just the accent. A name with nothing
 * latin in it at all reduces to empty, hence the fallback.
 */
export const slugify = (name: string): string => {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
    .replace(/-+$/, '')

  return slug || 'empresa'
}

const toTenant = (row: Record<string, unknown>): Tenant => ({
  id: row['id'] as string,
  slug: row['slug'] as string,
  companyName: row['company_name'] as string,
  supportPhone: row['support_phone'] as string,
  adminPhone: row['admin_phone'] as string,
  status: row['status'] as TenantStatus,
  // Supabase returns an aggregate relation as an array with one row.
  memberCount: (row['tenant_members'] as Array<{ count: number }> | undefined)?.[0]?.count ?? 0,
})
