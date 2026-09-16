import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { LanguageModel } from 'ai'
import { type TenantConfig, WisphubClient, createModels } from '@cobra/agent'
import {
  CredentialsCrypto,
  type TenantRuntimeConfig,
  loadTenantRuntime,
  requireCredential,
} from '@cobra/data'
import { MetaClient } from '../meta/meta.client.js'
import { SupabaseService } from './supabase.service.js'

export interface TenantRuntime {
  config: TenantConfig
  raw: TenantRuntimeConfig
  meta: MetaClient
  wisphub: WisphubClient
  models: { agent: LanguageModel; vision: LanguageModel }
}

/**
 * Everything one tenant needs to act, built per job.
 *
 * Not cached on purpose: a client who rotates a leaked key expects the next
 * message to use the new one, not the one this process loaded at boot.
 */
@Injectable()
export class TenantRuntimeService {
  private readonly crypto: CredentialsCrypto

  constructor(
    private readonly supabase: SupabaseService,
    config: ConfigService,
  ) {
    this.crypto = new CredentialsCrypto(config.getOrThrow<string>('CREDENTIALS_MASTER_KEY'))
  }

  async load(tenantId: string): Promise<TenantRuntime> {
    const raw = await loadTenantRuntime(this.supabase.admin, this.crypto, tenantId)

    const meta = requireCredential(raw, 'meta')
    const openrouter = requireCredential(raw, 'openrouter')
    const wisphub = requireCredential(raw, 'wisphub')

    if (!raw.phoneNumberId) {
      throw new Error(`El cliente ${tenantId} no tiene un número de WhatsApp activo`)
    }

    return {
      raw,
      config: {
        id: raw.id,
        companyName: raw.companyName,
        supportPhone: raw.supportPhone,
        adminPhone: raw.adminPhone,
      },
      meta: new MetaClient({ accessToken: meta.secret, phoneNumberId: raw.phoneNumberId }),
      wisphub: new WisphubClient({ apiKey: wisphub.secret }),
      models: createModels(openrouter.secret),
    }
  }
}
