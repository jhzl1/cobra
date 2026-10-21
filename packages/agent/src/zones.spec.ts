import { describe, expect, it } from 'vitest'
import { usableInZone } from './payment-methods'
import type { PaymentMethod } from './types'

const method = (zone: string | null): PaymentMethod => ({
  id: 'm',
  zone,
  entityName: 'Nequi Salgar',
  paymentAddress: '3001234567',
  wisphubId: '44324',
  description: null,
})

describe('usableInZone', () => {
  /**
   * The rule this exists for. An account with no zone is the company's general
   * one, and the repository used to exclude it the moment the customer had a
   * zone — so a customer in Salgar was never offered it.
   */
  it('offers an account with no zone to everyone', () => {
    expect(usableInZone(method(null), 'NETPLUS SALGAR')).toBe(true)
    expect(usableInZone(method(null), null)).toBe(true)
  })

  it('keeps an account with a zone for that zone only', () => {
    expect(usableInZone(method('NETPLUS SALGAR'), 'NETPLUS SALGAR')).toBe(true)
    expect(usableInZone(method('NETPLUS SALGAR'), 'NETPLUS GIRON')).toBe(false)
  })

  it('compares by name without caring about case or stray spaces', () => {
    expect(usableInZone(method(' netplus salgar '), 'NETPLUS SALGAR')).toBe(true)
  })

  /**
   * Telling a customer whose zone is unknown to pay into a zone's account is how
   * a receipt ends up rejected by rule 3 — the destination is the company's, but
   * not the one that customer was meant to use.
   */
  it('withholds a zoned account from a customer with no zone', () => {
    expect(usableInZone(method('NETPLUS SALGAR'), null)).toBe(false)
  })
})
