import { jobRunSchema, platformErrorSchema } from '@cobra/contracts'
import { toJobRun, toPlatformError } from './platform.service'

/** A row exactly as Supabase answers it: its column names, and the joined company. */
const row = (over: Record<string, unknown> = {}) => ({
  id: '5b0f1f43-3c55-4c43-9a2e-0b7a2c1f9d10',
  tenant_id: '1d3c8b52-7f0e-4a51-8f7c-2f5d0a6c9e21',
  conversation_id: 'd9760002-717b-4641-8c9a-5eb25a0d4625',
  queue: 'send-message',
  job_id: '8a4e2b19-6d7c-4f3a-9b1e-4c2d5f6a7b80',
  attempt: 2,
  max_attempts: 6,
  status: 'error',
  error: '(#131000) Something went wrong',
  started_at: '2026-10-21T15:02:11.000Z',
  finished_at: '2026-10-21T15:02:12.400Z',
  tenants: { company_name: 'Conecta Fibra' },
  ...over,
})

describe('toJobRun', () => {
  // Parsed with the schema so a column that drifts fails here, not on screen.
  it('answers in the shape the contract declares', () => {
    const parsed = jobRunSchema.safeParse(toJobRun(row()))

    expect(parsed.error?.issues).toBeUndefined()
  })

  it('keeps an attempt that is still running open', () => {
    const run = toJobRun(row({ status: 'running', error: null, finished_at: null }))

    expect(run.finishedAt).toBeNull()
    expect(run.error).toBeNull()
  })

  // An alert to the company's admin raised by no conversation has none.
  it('allows a job with no conversation', () => {
    expect(toJobRun(row({ conversation_id: null })).conversationId).toBeNull()
  })
})

describe('toPlatformError', () => {
  it('says whose error it is', () => {
    const parsed = platformErrorSchema.safeParse(toPlatformError(row()))

    expect(parsed.error?.issues).toBeUndefined()
    expect(parsed.data?.companyName).toBe('Conecta Fibra')
  })
})
