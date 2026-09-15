import { describe, expect, it } from 'vitest'
import type { PaymentMethod } from './types'
import { resolvePaymentMethod } from './payment-methods'

const method = (over: Partial<PaymentMethod>): PaymentMethod => ({
  id: 'pm',
  zone: null,
  entityName: 'NEQUI',
  paymentAddress: '3001234567',
  wisphubId: '7',
  description: null,
  ...over,
})

describe('resolvePaymentMethod', () => {
  it('matches a masked account by its suffix', () => {
    expect(resolvePaymentMethod([method({})], '4567', 'NEQUI')?.wisphubId).toBe('7')
  })

  it('refuses a suffix too short to tell two accounts apart', () => {
    expect(resolvePaymentMethod([method({})], '567', 'NEQUI')).toBeNull()
  })

  it('breaks a tie between two accounts by the entity read off the image', () => {
    const methods = [
      method({ id: 'a', entityName: 'NEQUI', paymentAddress: '3001234567', wisphubId: '7' }),
      method({ id: 'b', entityName: 'DAVIPLATA', paymentAddress: '3001234567', wisphubId: '9' }),
    ]

    expect(resolvePaymentMethod(methods, '3001234567', 'DAVIPLATA')?.wisphubId).toBe('9')
  })

  it('gives up when the tie cannot be broken, which rule 3 turns into a rejection', () => {
    const methods = [
      method({ id: 'a', wisphubId: '7' }),
      method({ id: 'b', wisphubId: '9' }),
    ]

    expect(resolvePaymentMethod(methods, '3001234567', 'OTHER')).toBeNull()
  })

  it('compares a Bre-B key whole, letters and all', () => {
    const methods = [method({ entityName: 'LLAVE', paymentAddress: '@cobra000', wisphubId: '3' })]

    expect(resolvePaymentMethod(methods, '@COBRA000', 'LLAVE')?.wisphubId).toBe('3')
  })

  it('ignores a method with no Wisphub id, because nothing can be registered with it', () => {
    expect(resolvePaymentMethod([method({ wisphubId: null })], '3001234567', 'NEQUI')).toBeNull()
  })
})
