import type { ModelCatalog, ModelOption, ModelRole } from '@cobra/contracts'

/** One entry of `GET https://openrouter.ai/api/v1/models`, only the fields read here. */
export interface OpenRouterModel {
  id: string
  name: string
  context_length?: number | null
  /** US dollars per token, as strings. `-1` on routers whose price varies. */
  pricing?: { prompt?: string; completion?: string }
  architecture?: { input_modalities?: string[] }
  supported_parameters?: string[]
}

interface RoleRequirements {
  inputModalities: string[]
  parameters: string[]
}

/**
 * What each call in `packages/agent` sends, and therefore what a model must
 * support. `createModels` asks OpenRouter for `require_parameters: true` and
 * `allow_fallbacks: false`, so a model missing any of these does not degrade:
 * every request to it fails. Change a call there and this list changes with it.
 *
 *   agent  — `generateText` in run-turn.ts: tools (with `tool_choice: auto`)
 *            and `temperature: 0`.
 *   vision — `generateObject` in read-receipt.ts: an image, a JSON schema as
 *            `response_format`, and `temperature: 0`.
 */
export const ROLE_REQUIREMENTS: Record<ModelRole, RoleRequirements> = {
  agent: {
    inputModalities: ['text'],
    parameters: ['tools', 'tool_choice', 'temperature'],
  },
  vision: {
    inputModalities: ['text', 'image'],
    parameters: ['response_format', 'structured_outputs', 'temperature'],
  },
}

export const isCompatible = (model: OpenRouterModel, role: ModelRole): boolean => {
  const requirements = ROLE_REQUIREMENTS[role]
  const modalities = model.architecture?.input_modalities ?? []
  const parameters = model.supported_parameters ?? []

  return (
    requirements.inputModalities.every((modality) => modalities.includes(modality)) &&
    requirements.parameters.every((parameter) => parameters.includes(parameter))
  )
}

/** Per token to per million tokens, which is how OpenRouter's own site shows it. */
const toPricePerMillion = (perToken: string | undefined): number | null => {
  const price = Number(perToken)

  if (perToken === undefined || !Number.isFinite(price) || price < 0) return null

  return Math.round(price * 1_000_000 * 1000) / 1000
}

/**
 * OpenRouter prefixes every name with its vendor ("Anthropic: Claude Haiku
 * 4.5"). The vendor is already in the id, which the panel shows and searches,
 * so the name drops it.
 */
const withoutVendor = (name: string): string => {
  const separator = name.indexOf(': ')

  return separator === -1 ? name : name.slice(separator + 2)
}

export const toModelOption = (model: OpenRouterModel): ModelOption => ({
  id: model.id,
  name: withoutVendor(model.name),
  contextLength: model.context_length ?? null,
  promptPricePerMillion: toPricePerMillion(model.pricing?.prompt),
  completionPricePerMillion: toPricePerMillion(model.pricing?.completion),
})

/** The catalog split per role, each list holding only what that role can run. */
export const toModelCatalog = (models: OpenRouterModel[]): ModelCatalog => {
  const catalog: ModelCatalog = { agent: [], vision: [] }

  for (const model of models) {
    const option = toModelOption(model)

    if (isCompatible(model, 'agent')) catalog.agent.push(option)
    if (isCompatible(model, 'vision')) catalog.vision.push(option)
  }

  // By the name the panel shows, now that the vendor no longer leads it.
  catalog.agent.sort((a, b) => a.name.localeCompare(b.name))
  catalog.vision.sort((a, b) => a.name.localeCompare(b.name))

  return catalog
}
