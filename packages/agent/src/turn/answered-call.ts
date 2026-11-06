import type { StepResult, ToolSet } from 'ai'

/** Who answered one model call: OpenRouter may change both inside the request. */
export interface AnsweredCall {
  model: string
  /** Null when OpenRouter did not say. */
  provider: string | null
}

/**
 * Read off each step as it ends, not off the final result: a turn that dies on
 * the timeout has no result, and the calls it already made are the clue to why.
 */
export const toAnsweredCall = (
  step: Pick<StepResult<ToolSet>, 'response' | 'providerMetadata'>,
): AnsweredCall => {
  const provider = step.providerMetadata?.['openrouter']?.['provider']

  // The OpenRouter provider fills an empty string when the response has none.
  const knownProvider = typeof provider === 'string' && provider ? provider : null

  return { model: step.response.modelId, provider: knownProvider }
}
