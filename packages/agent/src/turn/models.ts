import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import type { ModelRole } from '@cobra/contracts'

/**
 * One OpenRouter key per tenant, and two routing options that are not optional.
 *
 * The model ids come in from the caller: the platform chooses them in the panel
 * (`platform_settings`), and n8n's `Claude Haiku` and `Gemini 3.5 Flash` are only
 * the seed. Whatever is chosen has to support what these calls send — tools and
 * `temperature` for the agent, an image and structured output for the receipt —
 * and the API's catalog filter is what keeps an incompatible one out.
 *
 * `require_parameters: true` keeps OpenRouter from silently routing to a
 * provider that does not support structured output — the receipt parser then
 * starts failing intermittently with no error to point at. It applies to the
 * fallback providers and the fallback model too.
 *
 * `allow_fallbacks: true` lets OpenRouter try another provider of the same
 * model when the first one fails. Between 2026-11-02 and 2026-11-04 every
 * failed turn was the only provider of the chosen model answering 429 three
 * times. A fallback cannot run a tool twice: it happens inside one HTTP request
 * that the failed provider answered with nothing, and tools run here, between
 * model calls, only after a call has returned them.
 *
 * A role's fallback model goes in `models`, after its own: OpenRouter tries the
 * list in order once every provider of the one before has failed.
 */
export const createModels = (
  apiKey: string,
  modelIds: Record<ModelRole, string>,
  fallbackModelIds: Partial<Record<ModelRole, string>>,
): Record<ModelRole, LanguageModel> => {
  const openrouter = createOpenRouter({
    apiKey,
    extraBody: {
      provider: {
        require_parameters: true,
        allow_fallbacks: true,
      },
    },
  })

  const chatModel = (role: ModelRole): LanguageModel => {
    const modelId = modelIds[role]
    const fallbackModelId = fallbackModelIds[role]

    if (!fallbackModelId) return openrouter.chat(modelId)

    return openrouter.chat(modelId, { models: [modelId, fallbackModelId] })
  }

  return {
    agent: chatModel('agent'),
    vision: chatModel('vision'),
  }
}
