import { describe, expect, it } from 'vitest'
import type { ZodType } from 'zod'
import { sendMessageSchema } from './conversations'
import { grantRoleSchema } from './roles'
import {
  createTenantSchema,
  paymentMethodSchema,
  registerWhatsappNumberSchema,
  saveCredentialSchema,
} from './tenants'

/**
 * Words that only appear if a message came out of zod in English. `'string'` and
 * `'number'` are in here because the type errors are the ones most likely to
 * slip through: nothing on screen produces them, so nobody notices.
 */
const ENGLISH = /\b(expected|received|invalid|required|too (small|big)|string|number|characters)\b/i

const messagesOf = (schema: ZodType, input: unknown): string[] => {
  const result = schema.safeParse(input)

  expect(result.success).toBe(false)

  return result.error?.issues.map((issue) => issue.message) ?? []
}

/**
 * The panel shows these to the operator, and the API answers with the very same
 * strings, so one of them coming back in English is a defect on both sides at
 * once. The locale in ./locale covers whatever has no message of its own; this
 * is what proves it stays covered.
 */
describe('validation messages', () => {
  const cases: Array<[string, ZodType, unknown]> = [
    ['empty company', createTenantSchema, { companyName: '', supportPhone: '', adminPhone: '' }],
    [
      'malformed phones',
      createTenantSchema,
      { companyName: 'Acme', supportPhone: '15556640086x', adminPhone: '+57 300 123' },
    ],
    ['wrong types', createTenantSchema, { companyName: 42, supportPhone: null }],
    ['bad address', grantRoleSchema, { email: 'jahaziel' }],
    ['short secret', saveCredentialSchema, { provider: 'meta', secret: 'corto' }],
    ['short number', registerWhatsappNumberSchema, { phoneNumberId: 'abc', displayNumber: 'no' }],
    [
      'empty account',
      paymentMethodSchema,
      { entityName: '', paymentAddress: '', zone: 'z'.repeat(81), wisphubId: 'w'.repeat(41) },
    ],
    ['empty message', sendMessageSchema, { body: '' }],
  ]

  it.each(cases)('answers in Spanish: %s', (_name, schema, input) => {
    const messages = messagesOf(schema, input)

    expect(messages.length).toBeGreaterThan(0)
    for (const message of messages) expect(message).not.toMatch(ENGLISH)
  })
})
