import type { OpenRouterChatSettings } from '@openrouter/ai-sdk-provider'
import { describe, expect, it } from 'vitest'
import { createModels } from './models'

const MODEL_IDS = { agent: 'deepseek/deepseek-v4.1-flash', vision: 'google/gemini-3.5-flash' }

// The provider does not export its model class, only the settings it keeps.
const settingsOf = (model: unknown) => (model as { settings: OpenRouterChatSettings }).settings

describe('createModels', () => {
  it('lists the fallback after the role model, so OpenRouter tries it second', () => {
    const models = createModels('sk-or-test', MODEL_IDS, { agent: 'anthropic/claude-haiku-4.5' })

    expect(settingsOf(models.agent).models).toEqual([
      'deepseek/deepseek-v4.1-flash',
      'anthropic/claude-haiku-4.5',
    ])
  })

  it('sends no model list for a role without a fallback', () => {
    const models = createModels('sk-or-test', MODEL_IDS, { agent: 'anthropic/claude-haiku-4.5' })

    expect(settingsOf(models.vision).models).toBeUndefined()
  })
})
