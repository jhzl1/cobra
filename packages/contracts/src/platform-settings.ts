import { type ZodType, z } from 'zod'
// Side effect: zod answers in Spanish. Imported per module, not only from
// index, so importing this file directly cannot skip it.
import './locale'
import type { ModelRole } from './models'

/**
 * Settings that apply to every company at once, one row each in
 * `platform_settings`. The same list as the database enum
 * `platform_setting_key`: a key added there is added here too.
 */
export const platformSettingKeySchema = z.enum(['agent_model', 'vision_model'])

export type PlatformSettingKey = z.infer<typeof platformSettingKeySchema>

const modelIdSchema = z.string().trim().min(1, 'Elige un modelo')

/**
 * What each key may hold. The column is jsonb, so the database accepts any
 * value under any key: this is the only check of its type. The API applies it
 * before writing and the worker after reading, so a row edited by hand fails
 * its job with a reason instead of sending OpenRouter a number as a model id.
 */
export const platformSettingSchemas = {
  agent_model: modelIdSchema,
  vision_model: modelIdSchema,
} satisfies Record<PlatformSettingKey, ZodType>

export type PlatformSettingValues = {
  [Key in PlatformSettingKey]: z.infer<(typeof platformSettingSchemas)[Key]>
}

/** The setting that holds the model of each role. */
export const MODEL_SETTING_KEYS: Record<ModelRole, PlatformSettingKey> = {
  agent: 'agent_model',
  vision: 'vision_model',
}

/** One row as the panel reads it. `value` matches `platformSettingSchemas[key]`. */
export const platformSettingSchema = z.object({
  key: platformSettingKeySchema,
  value: z.unknown(),
  updatedAt: z.string(),
})

export type PlatformSetting = z.infer<typeof platformSettingSchema>

/** The body of `PUT /platform/settings/:key`, which depends on the key. */
export const updatePlatformSettingSchema = <Key extends PlatformSettingKey>(key: Key) =>
  z.object({ value: platformSettingSchemas[key] })
