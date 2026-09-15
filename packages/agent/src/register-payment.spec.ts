import { describe, expect, it, vi } from 'vitest'
import type { WisphubCustomer, WisphubPort } from './types'
import { planPayment, registerPayment } from './register-payment'

const customer = (over: Partial<WisphubCustomer> = {}): WisphubCustomer => ({
  found: true,
  documentNumber: '111',
  customerName: 'Ana',
  serviceId: 10,
  invoices: [{ id: 1, total: 50000 }],
  hasInvoices: true,
  invoicesCount: 1,
  totalDebt: '$ 50.000',
  totalDebtRaw: 50000,
  paymentMethods: [],
  ...over,
})

const input = {
  documentos: '111',
  monto: 50000,
  reference: 'M123456',
  fecha_pago: '2026-09-15 10:00',
  forma_pago: '7',
}

describe('planPayment', () => {
  it('refuses to register anything when one account could not be read', () => {
    const plan = planPayment({ ...input, documentos: '111,222' }, [customer()])

    expect(plan.decision).toBe('reject')
    expect(plan.decision === 'reject' && plan.message).toContain('222')
  })

  it('refuses when the amount is below the total owed', () => {
    const plan = planPayment({ ...input, monto: 30000 }, [customer()])

    expect(plan.decision).toBe('reject')
  })

  it('refuses several accounts unless the amount is the exact sum', () => {
    const plan = planPayment({ ...input, documentos: '111,222', monto: 90000 }, [
      customer(),
      customer({ documentNumber: '222', serviceId: 20, invoices: [{ id: 2, total: 50000 }] }),
    ])

    expect(plan.decision).toBe('reject')
  })

  it('refuses several accounts when one of them owes nothing', () => {
    const plan = planPayment({ ...input, documentos: '111,222', monto: 50000 }, [
      customer(),
      customer({
        documentNumber: '222',
        serviceId: 20,
        invoices: [],
        hasInvoices: false,
        invoicesCount: 0,
        totalDebtRaw: 0,
      }),
    ])

    expect(plan.decision).toBe('reject')
  })

  it('sends the customer to ApplyCredit when there is nothing to pay', () => {
    const plan = planPayment(input, [
      customer({ invoices: [], hasInvoices: false, invoicesCount: 0, totalDebtRaw: 0 }),
    ])

    expect(plan.decision === 'reject' && plan.message).toContain('ApplyCredit')
  })

  it('counts a document repeated in the input only once', () => {
    const plan = planPayment({ ...input, documentos: '111,111' }, [customer(), customer()])

    expect(plan.decision).toBe('pay')
    expect(plan.decision === 'pay' && plan.invoices).toHaveLength(1)
  })
})

describe('registerPayment', () => {
  const buildWisphub = (over: Partial<WisphubPort> = {}): WisphubPort => ({
    lookupCustomer: vi.fn(async () => customer()),
    getProfile: vi.fn(async () => ({ saldo: '0.00' })),
    registerInvoicePayment: vi.fn(async () => ({ ok: true })),
    updateBalance: vi.fn(async () => ({ ok: true })),
    ...over,
  })

  it('charges each invoice for its own exact amount, one call each', async () => {
    const wisphub = buildWisphub({
      lookupCustomer: vi.fn(async () =>
        customer({
          invoices: [
            { id: 1, total: 30000 },
            { id: 2, total: 20000 },
          ],
          invoicesCount: 2,
        }),
      ),
    })

    await registerPayment(input, { wisphub })

    expect(wisphub.registerInvoicePayment).toHaveBeenCalledTimes(2)
    expect(wisphub.registerInvoicePayment).toHaveBeenNthCalledWith(
      1,
      1,
      expect.objectContaining({ total_cobrado: 30000, accion: 1 }),
    )
    expect(wisphub.registerInvoicePayment).toHaveBeenNthCalledWith(
      2,
      2,
      expect.objectContaining({ total_cobrado: 20000 }),
    )
  })

  it('credits the excess through the profile, never inside the last invoice', async () => {
    const wisphub = buildWisphub()

    const result = await registerPayment({ ...input, monto: 70000 }, { wisphub })

    // The invoice is still charged for 50.000 and not for 70.000: Wisphub only
    // turns an overpayment into credit with a single invoice, and with several
    // it absorbs the difference silently. That is execution 7030, $45.000 gone.
    expect(wisphub.registerInvoicePayment).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ total_cobrado: 50000 }),
    )
    expect(wisphub.updateBalance).toHaveBeenCalledWith(10, '-20000.00')
    expect(result.excedente_a_saldo).toBe(20000)
    expect(result.success).toBe(true)
  })

  it('reports partial and warns the administrator when one invoice fails', async () => {
    const wisphub = buildWisphub({
      lookupCustomer: vi.fn(async () =>
        customer({
          invoices: [
            { id: 1, total: 30000 },
            { id: 2, total: 20000 },
          ],
        }),
      ),
      registerInvoicePayment: vi.fn(async (invoiceId: number) => {
        if (invoiceId === 2) throw new Error('Wisphub 500')
        return { ok: true }
      }),
    })

    const result = await registerPayment(input, { wisphub })

    expect(result.success).toBe(false)
    expect(result.estado).toBe('parcial')
    expect(result.failedInvoiceIds).toEqual([2])
    expect(result.adminMessage).toContain('PAGO PARCIAL')
  })

  it('reports partial when the invoices were paid but the excess could not be credited', async () => {
    const wisphub = buildWisphub({
      updateBalance: vi.fn(async () => {
        throw new Error('timeout')
      }),
    })

    const result = await registerPayment({ ...input, monto: 70000 }, { wisphub })

    expect(result.success).toBe(false)
    expect(result.excedente_a_saldo).toBe(0)
    expect(result.adminMessage).toContain('EXCEDENTE NO ABONADO')
  })

  it('sends Wisphub the moment of registration, not the date on the receipt', async () => {
    const wisphub = buildWisphub()

    await registerPayment(input, { wisphub, now: new Date('2026-09-20T15:30:00Z') })

    expect(wisphub.registerInvoicePayment).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ fecha_pago: '2026-09-20 10:30' }),
    )
  })
})
