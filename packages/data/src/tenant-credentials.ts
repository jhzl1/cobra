import type { SupabaseClient } from '@supabase/supabase-js'
import type { CredentialProvider } from '@cobra/contracts'
import { type CredentialPayload, CredentialsCrypto } from './credentials-crypto'

export interface TenantRuntimeConfig {
  id: string
  slug: string
  companyName: string
  supportPhone: string
  adminPhone: string
  status: 'active' | 'suspended'
  credentials: Partial<Record<CredentialProvider, CredentialPayload>>
  /** The number this tenant sends from. Null when none is active. */
  phoneNumberId: string | null
}

/**
 * Everything the worker needs to act on behalf of one tenant, in one read.
 *
 * Loading this per job rather than caching it is deliberate for now: a rotated
 * key has to take effect on the next message, not when a process restarts. If it
 * ever shows up in a profile, the cache goes here and nowhere else.
 */
export const loadTenantRuntime = async (
  client: SupabaseClient,
  crypto: CredentialsCrypto,
  tenantId: string,
): Promise<TenantRuntimeConfig> => {
  const [tenant, credentials, number] = await Promise.all([
    client
      .from('tenants')
      .select('id, slug, company_name, support_phone, admin_phone, status')
      .eq('id', tenantId)
      .single(),
    client.from('tenant_credentials').select('provider, ciphertext').eq('tenant_id', tenantId),
    client
      .from('whatsapp_numbers')
      .select('phone_number_id')
      .eq('tenant_id', tenantId)
      .is('valid_to', null)
      .maybeSingle(),
  ])

  if (tenant.error) throw tenant.error
  if (credentials.error) throw credentials.error

  const decrypted: Partial<Record<CredentialProvider, CredentialPayload>> = {}

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
    status: tenant.data.status as 'active' | 'suspended',
    credentials: decrypted,
    phoneNumberId: (number.data?.phone_number_id as string | undefined) ?? null,
  }
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
): CredentialPayload => {
  const credential = tenant.credentials[provider]

  if (!credential) throw new MissingCredentialError(tenant.id, provider)

  return credential
}
