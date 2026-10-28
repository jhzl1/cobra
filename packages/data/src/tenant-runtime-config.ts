import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type CredentialProvider,
  MODEL_SETTING_KEYS,
  type ModelRole,
  type PlatformSettingKey,
  type TenantStatus,
  platformSettingSchemas,
} from '@cobra/contracts'
import { CredentialsCrypto, type DecryptedCredential } from './credentials-crypto'

export interface TenantRuntimeConfig {
  id: string
  slug: string
  companyName: string
  supportPhone: string
  adminPhone: string
  status: TenantStatus
  /**
   * Nothing leaves towards the customer, the administrator or Wisphub. Read per
   * job like everything else here, so switching it applies to what is queued.
   */
  dryRun: boolean
  credentials: Partial<Record<CredentialProvider, DecryptedCredential>>
  /** The number this tenant sends from. Null when none is active. */
  phoneNumberId: string | null
  /**
   * OpenRouter's model id per role, from `platform_settings`. Shared by every
   * tenant, but read here so a change in the platform panel applies to the next
   * job, like a rotated key.
   */
  models: Record<ModelRole, string>
}

/**
 * Everything the worker needs to act on behalf of one tenant, in one read.
 *
 * Loading this per job rather than caching it is deliberate for now: a rotated
 * key has to take effect on the next message, not when a process restarts. If it
 * ever shows up in a profile, the cache goes here and nowhere else.
 */
export const loadTenantRuntimeConfig = async (
  client: SupabaseClient,
  crypto: CredentialsCrypto,
  tenantId: string,
): Promise<TenantRuntimeConfig> => {
  const [tenant, credentials, number, settings] = await Promise.all([
    client
      .from('tenants')
      .select('id, slug, company_name, support_phone, admin_phone, status, dry_run')
      .eq('id', tenantId)
      .single(),
    client.from('tenant_credentials').select('provider, ciphertext').eq('tenant_id', tenantId),
    client
      .from('whatsapp_numbers')
      .select('phone_number_id')
      .eq('tenant_id', tenantId)
      .is('valid_to', null)
      .maybeSingle(),
    client
      .from('platform_settings')
      .select('key, value')
      .in('key', Object.values(MODEL_SETTING_KEYS)),
  ])

  if (tenant.error) throw tenant.error
  if (credentials.error) throw credentials.error
  if (settings.error) throw settings.error

  const models = toModels(settings.data ?? [])

  const decrypted: Partial<Record<CredentialProvider, DecryptedCredential>> = {}

  for (const row of credentials.data ?? []) {
    const provider = row.provider as CredentialProvider

    try {
      decrypted[provider] = crypto.decrypt(row.ciphertext as string)
    } catch {
      // One unreadable credential must not make the other two unusable: the
      // caller finds out when it asks for the one that is missing.
    }
  }

  return {
    id: tenant.data.id as string,
    slug: tenant.data.slug as string,
    companyName: tenant.data.company_name as string,
    supportPhone: tenant.data.support_phone as string,
    adminPhone: tenant.data.admin_phone as string,
    status: tenant.data.status as TenantStatus,
    dryRun: tenant.data.dry_run as boolean,
    credentials: decrypted,
    phoneNumberId: (number.data?.phone_number_id as string | undefined) ?? null,
    models,
  }
}

/**
 * Fails rather than falling back to a hardcoded model: the migration seeds both
 * keys, so a missing or malformed one means someone touched the table by hand,
 * and silently running a model nobody chose is worse than a job that says why
 * it stopped.
 */
const toModels = (rows: Record<string, unknown>[]): Record<ModelRole, string> => {
  const byKey = new Map<PlatformSettingKey, unknown>()

  for (const row of rows) byKey.set(row['key'] as PlatformSettingKey, row['value'])

  const readModel = (role: ModelRole): string => {
    const key = MODEL_SETTING_KEYS[role]
    const parsed = platformSettingSchemas[key].safeParse(byKey.get(key))

    if (!parsed.success) {
      throw new Error(`El ajuste ${key} de platform_settings falta o no es un modelo válido`)
    }

    return parsed.data
  }

  return { agent: readModel('agent'), vision: readModel('vision') }
}

export class MissingCredentialError extends Error {
  constructor(
    readonly tenantId: string,
    readonly provider: CredentialProvider,
  ) {
    super(`El cliente ${tenantId} no tiene cargada la credencial de ${provider}`)
    this.name = 'MissingCredentialError'
  }
}

export const requireCredential = (
  tenant: TenantRuntimeConfig,
  provider: CredentialProvider,
): DecryptedCredential => {
  const credential = tenant.credentials[provider]

  if (!credential) throw new MissingCredentialError(tenant.id, provider)

  return credential
}
