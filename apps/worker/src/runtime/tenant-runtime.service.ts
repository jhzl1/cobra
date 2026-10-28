import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { LanguageModel } from 'ai'
import {
  type TenantConfig,
  WisphubClient,
  type WisphubPort,
  createModels,
} from '@cobra/agent'
import {
  CredentialsCrypto,
  type TenantRuntimeConfig,
  loadTenantRuntimeConfig,
  requireCredential,
} from '@cobra/data'
import { DualhookClient } from '../whatsapp/dualhook.client.js'
import { SupabaseService } from './supabase.service.js'

export interface TenantRuntime {
  /** The subset of the tenant the agent is allowed to see. */
  agentConfig: TenantConfig
  /** The whole decrypted tenant row: credentials, status, phone number id. */
  runtimeConfig: TenantRuntimeConfig
  /** WhatsApp: sending, read receipts and media, through Dualhook. */
  whatsapp: DualhookClient
  /** Simulates its writes while the company is in dry-run. */
  wisphub: WisphubPort
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
    const runtimeConfig = await loadTenantRuntimeConfig(
      this.supabase.unscoped,
      this.crypto,
      tenantId,
    )

    const dualhook = requireCredential(runtimeConfig, 'dualhook')
    const openrouter = requireCredential(runtimeConfig, 'openrouter')
    const wisphub = requireCredential(runtimeConfig, 'wisphub')

    if (!runtimeConfig.phoneNumberId) {
      throw new Error(`El cliente ${tenantId} no tiene un número de WhatsApp activo`)
    }

    return {
      runtimeConfig,
      agentConfig: {
        id: runtimeConfig.id,
        companyName: runtimeConfig.companyName,
        supportPhone: runtimeConfig.supportPhone,
        adminPhone: runtimeConfig.adminPhone,
      },
      whatsapp: new DualhookClient({
        apiKey: dualhook.secret,
        phoneNumberId: runtimeConfig.phoneNumberId,
      }),
      wisphub: new WisphubClient({ apiKey: wisphub.secret, dryRun: runtimeConfig.dryRun }),
      models: createModels(openrouter.secret),
    }
  }
}
