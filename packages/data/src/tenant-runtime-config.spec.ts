import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import type { CredentialsCrypto } from './credentials-crypto'
import { loadTenantRuntimeConfig } from './tenant-runtime-config'

const TENANT = '11111111-1111-1111-1111-111111111111'

const TENANT_ROW = {
  id: TENANT,
  slug: 'acme',
  company_name: 'Acme',
  support_phone: '+573001112233',
  admin_phone: '+573004445566',
  status: 'active',
  dry_run: true,
}

/**
 * Every query of the loader awaits a chain of filters. This answers each table
 * with a fixed result, whatever filters were chained before the `await`.
 */
const buildClient = (settings: Array<{ key: string; value: unknown }>) => {
  const results: Record<string, { data: unknown; error: null }> = {
    tenants: { data: TENANT_ROW, error: null },
    tenant_credentials: { data: [], error: null },
    whatsapp_numbers: { data: { phone_number_id: '112665125154828' }, error: null },
    platform_settings: { data: settings, error: null },
  }

  const chainFor = (result: unknown): unknown =>
    new Proxy(
      {},
      {
        get: (_target, property) => {
          if (property === 'then') {
            return (resolve: (value: unknown) => void) => resolve(result)
          }

          return () => chainFor(result)
        },
      },
    )

  return { from: (table: string) => chainFor(results[table]) } as unknown as SupabaseClient
}

const crypto = {} as CredentialsCrypto

const MODELS = [
  { key: 'agent_model', value: 'deepseek/deepseek-v4.1-flash' },
  { key: 'vision_model', value: 'google/gemini-3.5-flash' },
]

describe('loadTenantRuntimeConfig fallback models', () => {
  it('reads the fallback of the conversation when one is chosen', async () => {
    const client = buildClient([
      ...MODELS,
      { key: 'agent_fallback_model', value: 'anthropic/claude-haiku-4.5' },
    ])

    const config = await loadTenantRuntimeConfig(client, crypto, TENANT)

    expect(config.fallbackModels).toEqual({ agent: 'anthropic/claude-haiku-4.5' })
  })

  it('has no fallback when the row is missing, as the migration leaves it', async () => {
    const config = await loadTenantRuntimeConfig(buildClient(MODELS), crypto, TENANT)

    expect(config.fallbackModels).toEqual({})
  })

  it('has no fallback when the panel removed it', async () => {
    const client = buildClient([...MODELS, { key: 'agent_fallback_model', value: null }])

    const config = await loadTenantRuntimeConfig(client, crypto, TENANT)

    expect(config.fallbackModels).toEqual({})
  })

  it('fails the job on a fallback edited by hand into something that is not a model', async () => {
    const client = buildClient([...MODELS, { key: 'agent_fallback_model', value: 42 }])

    await expect(loadTenantRuntimeConfig(client, crypto, TENANT)).rejects.toThrow(
      'agent_fallback_model',
    )
  })
})
