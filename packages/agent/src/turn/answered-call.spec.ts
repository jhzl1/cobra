import type { StepResult, ToolSet } from 'ai'
import { describe, expect, it } from 'vitest'
import { toAnsweredCall } from './answered-call'

type StepFields = Pick<StepResult<ToolSet>, 'response' | 'providerMetadata'>

const stepOf = (modelId: string, providerMetadata: StepFields['providerMetadata']) =>
  ({ response: { modelId }, providerMetadata }) as StepFields

describe('toAnsweredCall', () => {
  it('reads the model and provider OpenRouter answered with', () => {
    const step = stepOf('anthropic/claude-haiku-4.5', { openrouter: { provider: 'Anthropic' } })

    expect(toAnsweredCall(step)).toEqual({
      model: 'anthropic/claude-haiku-4.5',
      provider: 'Anthropic',
    })
  })

  it('leaves the provider null when OpenRouter sent an empty one', () => {
    const step = stepOf('deepseek/deepseek-v4.1-flash', { openrouter: { provider: '' } })

    expect(toAnsweredCall(step).provider).toBeNull()
  })

  it('leaves the provider null when there is no OpenRouter metadata', () => {
    const step = stepOf('deepseek/deepseek-v4.1-flash', undefined)

    expect(toAnsweredCall(step).provider).toBeNull()
  })
})
