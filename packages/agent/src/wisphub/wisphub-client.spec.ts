import { describe, expect, it, vi } from 'vitest'
import { applyCredit } from '../payments/apply-credit'
import { registerPayment } from '../payments/register-payment'
import { SIMULATED_WISPHUB_WRITE, WisphubClient } from './wisphub-client'

/** Wisphub answering one customer, 111, with one invoice of $50.000 and no balance. */
const fakeWisphub = (options: { invoices: Array<{ id: number; total: number }> }) =>
  vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const path = String(url)
    let body: unknown = { ok: true }

    if (path.includes('/api/clientes?cedula=')) {
      body = { results: [{ id_servicio: 10, cedula: '111', nombre: 'Ana' }] }
    } else if (path.endsWith('/saldo')) {
      const debt = options.invoices.reduce((sum, invoice) => sum + invoice.total, 0)
      body = { nombre: 'Ana', facturas: options.invoices, saldo: debt }
    } else if (path.endsWith('/perfil/')) {
      body = { saldo: '0.00' }
    }

    return new Response(JSON.stringify(body), { status: 200 })
  })

const writesIn = (fetchImpl: ReturnType<typeof fakeWisphub>) =>
  fetchImpl.mock.calls.filter(([, init]) => init?.method !== 'GET')

describe('WisphubClient in dry-run', () => {
  it('reads the real account and never sends a write', async () => {
    const fetchImpl = fakeWisphub({ invoices: [{ id: 1, total: 50000 }] })
    const wisphub = new WisphubClient({ apiKey: 'key', dryRun: true, fetchImpl })

    const found = await wisphub.lookupCustomer('111')
    const payment = await wisphub.registerInvoicePayment(1, {
      referencia: 'M123456',
      fecha_pago: '2026-10-27 10:30',
      total_cobrado: 50000,
      accion: 1,
      forma_pago: '7',
    })
    const balance = await wisphub.updateBalance(10, '-20000.00')

    expect(found.customerName).toBe('Ana')
    expect(payment).toEqual(SIMULATED_WISPHUB_WRITE)
    expect(balance).toEqual(SIMULATED_WISPHUB_WRITE)
    expect(writesIn(fetchImpl)).toHaveLength(0)
  })

  it('lets registerPayment answer exactly as a clean payment would', async () => {
    const fetchImpl = fakeWisphub({ invoices: [{ id: 1, total: 50000 }] })
    const wisphub = new WisphubClient({ apiKey: 'key', dryRun: true, fetchImpl })

    const result = await registerPayment(
      { documents: '111', amount: 70000, reference: 'M123456', paymentMethodId: '7' },
      { wisphub },
    )

    // The model must hear the production answer, excess credited included, or
    // the dry-run trains it on a conversation no customer will ever have.
    expect(result.success).toBe(true)
    expect(result.status).toBe('complete')
    expect(result.paidInvoices).toBe(1)
    expect(result.creditedExcess).toBe(20000)
    expect(writesIn(fetchImpl)).toHaveLength(0)
  })

  it('lets applyCredit answer exactly as a real credit would', async () => {
    const fetchImpl = fakeWisphub({ invoices: [] })
    const wisphub = new WisphubClient({ apiKey: 'key', dryRun: true, fetchImpl })

    const result = await applyCredit(
      { document: '111', amount: 30000, reference: 'M123456', paymentMethodId: '7' },
      { wisphub },
    )

    expect(result.success).toBe(true)
    expect(result.creditBalance).toBe('30000.00')
    expect(writesIn(fetchImpl)).toHaveLength(0)
  })

  it('writes for real when the company is live', async () => {
    const fetchImpl = fakeWisphub({ invoices: [{ id: 1, total: 50000 }] })
    const wisphub = new WisphubClient({ apiKey: 'key', fetchImpl })

    await wisphub.updateBalance(10, '-20000.00')

    expect(writesIn(fetchImpl)).toHaveLength(1)
  })
})
