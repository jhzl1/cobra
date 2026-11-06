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
export const platformSettingKeySchema = z.enum([
  'agent_model',
  'vision_model',
  'agent_fallback_model',
])

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
  // Null is "no fallback", and saving it is how the panel removes one.
  agent_fallback_model: modelIdSchema.nullable(),
} satisfies Record<PlatformSettingKey, ZodType>

export type PlatformSettingValues = {
  [Key in PlatformSettingKey]: z.infer<(typeof platformSettingSchemas)[Key]>
}

/**
 * The setting that holds the model of each role. Narrowed with `as const` so
 * its keys type to schemas that never take null: a role always has a model.
 */
export const MODEL_SETTING_KEYS = {
  agent: 'agent_model',
  vision: 'vision_model',
} as const satisfies Record<ModelRole, PlatformSettingKey>

/**
 * The setting that holds the fallback model of a role, for the roles that have
 * one. A fallback has to support the same things as its role's model, so it is
 * checked against the same catalog.
 */
export const FALLBACK_MODEL_SETTING_KEYS: Partial<Record<ModelRole, PlatformSettingKey>> = {
  agent: 'agent_fallback_model',
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
