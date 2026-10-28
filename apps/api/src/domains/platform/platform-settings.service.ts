import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import type { PostgrestError } from '@supabase/supabase-js'
import {
  MODEL_SETTING_KEYS,
  type ModelCatalog,
  type ModelRole,
  type PlatformSetting,
  type PlatformSettingKey,
  type PlatformSettingValues,
} from '@cobra/contracts'
import { SupabaseService } from '~/supabase/supabase.service'
import { type OpenRouterModel, toModelCatalog } from './model-catalog'

/** Public, and needs no key: the catalog is the same for every account. */
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'
const CATALOG_TIMEOUT_MS = 10_000
/**
 * The catalog changes a few times a week, and the screen that reads it is
 * opened by a handful of administrators. Ten minutes keeps a save from waiting
 * on OpenRouter twice in a row without hiding a new model for long.
 */
const CATALOG_TTL_MS = 10 * 60_000

const SETTING_COLUMNS = 'key, value, updated_at'

/** The role whose model a key holds, or null for a setting that is not a model. */
const modelRoleOf = (key: PlatformSettingKey): ModelRole | null => {
  for (const [role, modelKey] of Object.entries(MODEL_SETTING_KEYS)) {
    if (modelKey === key) return role as ModelRole
  }

  return null
}

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name)
  private cachedCatalog: { catalog: ModelCatalog; fetchedAt: number } | null = null

  constructor(private readonly supabase: SupabaseService) {}

  async listSettings(): Promise<PlatformSetting[]> {
    const { data, error } = await this.supabase.unscoped
      .from('platform_settings')
      .select(SETTING_COLUMNS)
      .order('key')

    if (error) throw this.toHttpError(error)

    return (data ?? []).map(toPlatformSetting)
  }

  async catalog(): Promise<ModelCatalog> {
    const isFresh = this.cachedCatalog && Date.now() - this.cachedCatalog.fetchedAt < CATALOG_TTL_MS

    if (isFresh && this.cachedCatalog) return this.cachedCatalog.catalog

    const models = await this.fetchOpenRouterModels()
    const catalog = toModelCatalog(models)

    this.cachedCatalog = { catalog, fetchedAt: Date.now() }

    return catalog
  }

  /**
   * `value` arrives already checked against the key's schema. A model is also
   * checked against the filtered catalog: an id that exists but lacks tools or
   * structured output would pass the schema and then fail every turn of every
   * company, starting with the next message.
   */
  async update<Key extends PlatformSettingKey>({
    key,
    value,
    updatedBy,
  }: {
    key: Key
    value: PlatformSettingValues[Key]
    updatedBy: string
  }): Promise<PlatformSetting> {
    const role = modelRoleOf(key)

    if (role) await this.assertModelAvailable(role, value)

    // Upsert rather than update: the migration seeds every key, but a key with
    // no row would otherwise answer "saved" and change nothing.
    const { data, error } = await this.supabase.unscoped
      .from('platform_settings')
      .upsert({ key, value, updated_by: updatedBy, updated_at: new Date().toISOString() })
      .select(SETTING_COLUMNS)
      .single()

    if (error) throw this.toHttpError(error)

    this.logger.log(`Platform setting ${key} set to ${JSON.stringify(value)}`)

    return toPlatformSetting(data)
  }

  private async assertModelAvailable(role: ModelRole, modelId: string): Promise<void> {
    const catalog = await this.catalog()
    const isAvailable = catalog[role].some((option) => option.id === modelId)

    if (!isAvailable) {
      throw new BadRequestException(
        'Ese modelo no está en OpenRouter o no soporta lo que necesita esta tarea. Elige uno de la lista.',
      )
    }
  }

  private async fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
    try {
      const response = await fetch(OPENROUTER_MODELS_URL, {
        signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS),
      })

      if (!response.ok) throw new Error(`OpenRouter answered ${response.status}`)

      const body = (await response.json()) as { data?: OpenRouterModel[] }

      return body.data ?? []
    } catch (error) {
      this.logger.error(`OpenRouter catalog: ${(error as Error).message}`)

      throw new ServiceUnavailableException(
        'No se pudo consultar el catálogo de OpenRouter. Intenta de nuevo en unos minutos.',
      )
    }
  }

  private toHttpError(error: PostgrestError): Error {
    this.logger.error(`Postgrest ${error.code}: ${error.message}`)

    return new InternalServerErrorException('No se pudo completar la operación')
  }
}

export const toPlatformSetting = (row: Record<string, unknown>): PlatformSetting => ({
  key: row['key'] as PlatformSettingKey,
  value: row['value'],
  updatedAt: row['updated_at'] as string,
})
