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
 * starts failing intermittently with no error to point at.
 *
 * `allow_fallbacks: false` is about money, not quality: a retry after a 5xx can
 * run the turn a second time, and by then the tools may already have charged
 * the customer in Wisphub.
 */
export const createModels = (
  apiKey: string,
  modelIds: Record<ModelRole, string>,
): Record<ModelRole, LanguageModel> => {
  const openrouter = createOpenRouter({
    apiKey,
    extraBody: {
      provider: {
        require_parameters: true,
        allow_fallbacks: false,
      },
    },
  })

  return {
    agent: openrouter.chat(modelIds.agent),
    vision: openrouter.chat(modelIds.vision),
  }
}
