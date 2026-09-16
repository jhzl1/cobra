import { describe, expect, it } from 'vitest'
import type { ReceiptExtraction } from '@cobra/contracts'
import type { PaymentMethod } from './types'
import { validateReceipt } from './validation'

const method: PaymentMethod = {
  id: 'pm-1',
  zone: 'centro',
  entityName: 'NEQUI',
  paymentAddress: '3001234567',
  wisphubId: '7',
  description: 'Nequi principal',
}

const extraction = (over: Partial<ReceiptExtraction> = {}): ReceiptExtraction => ({
  destinationMethod: 'NEQUI',
  amount: 50000,
  paymentDatetime: '2026-09-15T09:00:00',
  reference: ['M123456'],
  destinationAccount: '3001234567',
  confidence: 0.98,
  isVoucher: true,
  humanDescription: 'Transferencia Nequi',
  ...over,
})

const now = new Date('2026-09-15T15:00:00Z')

describe('validateReceipt', () => {
  it('accepts a fresh receipt paid into one of the tenant accounts', () => {
    const result = validateReceipt({
      extraction: extraction(),
      paymentMethods: [method],
      isReferenceUsed: false,
      now,
    })

    expect(result.alertReason).toBeNull()
    expect(result.paymentMethod?.wisphubId).toBe('7')
  })

  it('rejects anything that is not a receipt first of all', () => {
    const result = validateReceipt({
      // Stale as well, and paid nowhere. Rule 1 still wins.
      extraction: extraction({
        isVoucher: false,
        paymentDatetime: '2026-01-01T09:00:00',
        destinationAccount: '999',
      }),
      paymentMethods: [method],
      isReferenceUsed: true,
      now,
    })

    expect(result.alertReason).toBe('not_a_voucher')
  })

  it('rejects a readable date older than seven days before looking at the account', () => {
    const result = validateReceipt({
      extraction: extraction({
        paymentDatetime: '2026-09-01T09:00:00',
        destinationAccount: '999999',
      }),
      paymentMethods: [method],
      isReferenceUsed: false,
      now,
    })

    expect(result.alertReason).toBe('older_than_7_days')
  })

  it('rejects a destination that is not the company', () => {
    const result = validateReceipt({
      extraction: extraction({ destinationAccount: '3009999999' }),
      paymentMethods: [method],
      isReferenceUsed: false,
      now,
    })

    expect(result.alertReason).toBe('destination_not_ours')
  })

  it('rejects a reference already spent', () => {
    const result = validateReceipt({
      extraction: extraction(),
      paymentMethods: [method],
      isReferenceUsed: true,
      now,
    })

    expect(result.alertReason).toBe('reference_already_used')
  })

  it('separates an unreadable date from a stale one, and reports it last', () => {
    const result = validateReceipt({
      extraction: extraction({ paymentDatetime: '' }),
      paymentMethods: [method],
      isReferenceUsed: false,
      now,
    })

    expect(result.alertReason).toBe('unreadable_date')
    expect(result.isPaymentDateReadable).toBe(false)
  })
})
