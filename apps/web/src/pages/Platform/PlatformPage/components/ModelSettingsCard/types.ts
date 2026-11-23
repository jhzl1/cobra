import type { ModelRole, PlatformSettingKey } from '@cobra/contracts'

/**
 * One model a task runs, read off its key in `platform_settings`: the task's
 * own model, or the fallback OpenRouter tries when that one fails.
 */
export interface ModelRow {
  key: PlatformSettingKey
  role: ModelRole
  isFallback: boolean
  /** Null only for a fallback nobody has chosen. */
  modelId: string | null
  updatedAt: string | null
}
