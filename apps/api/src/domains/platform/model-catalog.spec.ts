import { modelCatalogSchema } from '@cobra/contracts'
import { type OpenRouterModel, toModelCatalog } from './model-catalog'

/** An entry shaped like OpenRouter's answer, with what the two current models support. */
const model = (over: Partial<OpenRouterModel> = {}): OpenRouterModel => ({
  id: 'anthropic/claude-haiku-4.5',
  name: 'Anthropic: Claude Haiku 4.5',
  context_length: 200000,
  pricing: { prompt: '0.000001', completion: '0.000005' },
  architecture: { input_modalities: ['text', 'image', 'file'] },
  supported_parameters: [
    'max_tokens',
    'response_format',
    'structured_outputs',
    'temperature',
    'tool_choice',
    'tools',
  ],
  ...over,
})

const ids = (options: { id: string }[]) => options.map((option) => option.id)

describe('toModelCatalog', () => {
  it('offers a model that supports everything to both roles', () => {
    const catalog = toModelCatalog([model()])

    expect(ids(catalog.agent)).toEqual(['anthropic/claude-haiku-4.5'])
    expect(ids(catalog.vision)).toEqual(['anthropic/claude-haiku-4.5'])
  })

  /**
   * `require_parameters: true` turns a missing parameter into a request no
   * provider accepts, so offering this model would fail every turn.
   */
  it('keeps a model without tools out of the agent', () => {
    const catalog = toModelCatalog([
      model({ id: 'x/no-tools', supported_parameters: ['temperature', 'structured_outputs'] }),
    ])

    expect(catalog.agent).toEqual([])
  })

  it('keeps a text-only model out of the receipt reader', () => {
    const catalog = toModelCatalog([
      model({ id: 'x/text-only', architecture: { input_modalities: ['text'] } }),
    ])

    expect(ids(catalog.agent)).toEqual(['x/text-only'])
    expect(catalog.vision).toEqual([])
  })

  it('keeps a model without structured output out of the receipt reader', () => {
    const catalog = toModelCatalog([
      model({
        id: 'x/no-schema',
        supported_parameters: ['temperature', 'tools', 'tool_choice', 'response_format'],
      }),
    ])

    expect(catalog.vision).toEqual([])
  })

  it('treats a model with no declared parameters as incompatible', () => {
    const catalog = toModelCatalog([
      model({ id: 'x/bare', supported_parameters: undefined, architecture: undefined }),
    ])

    expect(catalog).toEqual({ agent: [], vision: [] })
  })

  it('prices per million tokens, and leaves variable prices empty', () => {
    const [haiku, router] = toModelCatalog([
      model(),
      model({ id: 'openrouter/auto', name: 'Auto Router', pricing: { prompt: '-1' } }),
    ]).agent.sort((a, b) => a.id.localeCompare(b.id))

    expect(haiku).toMatchObject({ promptPricePerMillion: 1, completionPricePerMillion: 5 })
    expect(router).toMatchObject({ promptPricePerMillion: null, completionPricePerMillion: null })
  })

  it('drops the vendor that OpenRouter puts before the name', () => {
    const [haiku] = toModelCatalog([model()]).agent

    expect(haiku?.name).toBe('Claude Haiku 4.5')
  })

  it('sorts by name and answers the contract the panel reads', () => {
    const catalog = toModelCatalog([
      model({ id: 'z/zeta', name: 'Zeta' }),
      model({ id: 'a/alpha', name: 'Alpha' }),
    ])

    expect(ids(catalog.agent)).toEqual(['a/alpha', 'z/zeta'])
    expect(modelCatalogSchema.parse(catalog)).toEqual(catalog)
  })
})
