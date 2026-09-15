import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'

/** The agent. Same model as n8n's `Claude Haiku` node. */
export const AGENT_MODEL = 'anthropic/claude-haiku-4.5'
/** The receipt extractor. Same model as n8n's `Gemini 3.5 Flash` node. */
export const VISION_MODEL = 'google/gemini-3.5-flash'

/**
 * One OpenRouter key per tenant, and two routing options that are not optional.
 *
 * `require_parameters: true` keeps OpenRouter from silently routing to a
 * provider that does not support structured output — the receipt parser then
 * starts failing intermittently with no error to point at.
 *
 * `allow_fallbacks: false` is about money, not quality: a retry after a 5xx can
 * run the turn a second time, and by then the tools may already have charged
 * the customer in Wisphub.
 */
export const createModels = (apiKey: string): { agent: LanguageModel; vision: LanguageModel } => {
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
    agent: openrouter.chat(AGENT_MODEL),
    vision: openrouter.chat(VISION_MODEL),
  }
}
