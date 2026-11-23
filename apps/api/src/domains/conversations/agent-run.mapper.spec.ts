import { agentRunSchema } from '@cobra/contracts'
import { toAgentRun } from './conversations.service'

/** A row exactly as Supabase answers it: its column names, and the nested relation. */
const row = (over: Record<string, unknown> = {}) => ({
  id: '9e27ed33-4d98-4dde-bd0f-3625ed2d22b5',
  conversation_id: 'd9760002-717b-4641-8c9a-5eb25a0d4625',
  trigger: 'inbound',
  status: 'done',
  model: 'anthropic/claude-haiku-4.5',
  input_tokens: 120,
  output_tokens: 30,
  error: null,
  started_at: '2026-09-16T22:06:28.709Z',
  finished_at: '2026-09-16T22:06:31.388Z',
  agent_steps: [
    {
      id: '0e54cee7-0160-45da-a745-c224b88c5802',
      run_id: '9e27ed33-4d98-4dde-bd0f-3625ed2d22b5',
      seq: 1,
      kind: 'llm',
      name: 'agent',
      status: 'done',
      tool_call_id: null,
      input: null,
      output: { steps: 1 },
      error: null,
      duration_ms: 2679,
      created_at: '2026-09-16T22:06:31.314Z',
    },
  ],
  ...over,
})

describe('toAgentRun', () => {
  /**
   * The panel reads the contract, and this endpoint used to answer with
   * Postgres' names — so `run.steps` was never there and the timeline crashed
   * the moment a conversation had a run to draw. Parsing with the schema is the
   * point: it fails on a field that drifts, not only on the one that broke.
   */
  it('answers in the shape the contract declares', () => {
    const parsed = agentRunSchema.safeParse(toAgentRun(row()))

    expect(parsed.error?.issues).toBeUndefined()
    expect(parsed.success).toBe(true)
  })

  it('carries the steps across, renamed', () => {
    const run = toAgentRun(row())

    expect(run.steps).toHaveLength(1)
    expect(run.steps[0]?.durationMs).toBe(2679)
    expect(run.steps[0]?.runId).toBe(run.id)
  })

  /**
   * A run that has only just started has no steps yet — which is precisely the
   * state the live timeline exists to show, and the one that crashed it.
   */
  it('gives an empty array for a run with no steps yet', () => {
    expect(
      toAgentRun(row({ agent_steps: null, status: 'running', finished_at: null })).steps,
    ).toEqual([])
    expect(
      toAgentRun(row({ agent_steps: [], status: 'running', finished_at: null })).steps,
    ).toEqual([])
  })
})
