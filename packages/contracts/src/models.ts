import { z } from 'zod'
// Side effect: zod answers in Spanish. Imported per module, not only from
// index, so importing this file directly cannot skip it.
import './locale'

/**
 * The two places the worker calls a model. Each one asks different things of
 * it, which is why the catalog is filtered per role and not once.
 */
export const modelRoleSchema = z.enum(['agent', 'vision'])

export type ModelRole = z.infer<typeof modelRoleSchema>

/** One entry of OpenRouter's catalog, already known to work for a role. */
export const modelOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  contextLength: z.number().int().nullable(),
  /** US dollars per million tokens. Null when OpenRouter does not publish it. */
  promptPricePerMillion: z.number().nullable(),
  completionPricePerMillion: z.number().nullable(),
})

export type ModelOption = z.infer<typeof modelOptionSchema>

export const modelCatalogSchema = z.object({
  agent: z.array(modelOptionSchema),
  vision: z.array(modelOptionSchema),
})

export type ModelCatalog = z.infer<typeof modelCatalogSchema>
