import { describe, expect, it, vi } from 'vitest'
import type { WisphubCustomer, WisphubPort } from '@cobra/agent'
import type { ConversationRepository } from '../repositories/conversation.repository.js'
import type { PaymentMethodRepository } from '../repositories/payment-method.repository.js'
import type { ReceiptRepository } from '../repositories/receipt.repository.js'
import type { TenantAdminAlertService } from '../runtime/tenant-admin-alert.service.js'
import type { TenantRuntime, TenantRuntimeService } from '../runtime/tenant-runtime.service.js'
import { ApplyHeldReceiptJobHandler } from './apply-held-receipt.job.js'

const TENANT_ID = '11111111-1111-1111-1111-111111111111'
const RECEIPT_ID = '22222222-2222-2222-2222-222222222222'
const METHOD_ID = '33333333-3333-3333-3333-333333333333'

const PAYLOAD = {
  tenantId: TENANT_ID,
  receiptId: RECEIPT_ID,
  documents: '91290838',
  amount: 50_000,
  paymentMethodId: METHOD_ID,
  appliedBy: '44444444-4444-4444-4444-444444444444',
}

const customerOwing = (debt: number): WisphubCustomer => ({
  found: true,
  documentNumber: '91290838',
  customerName: 'Felix Vera',
  serviceId: 7,
  invoices: debt ? [{ id: 900, total: debt }] : [],
  hasInvoices: debt > 0,
  invoicesCount: debt ? 1 : 0,
  totalDebt: `$ ${debt}`,
  totalDebtRaw: debt,
  paymentMethods: [],
})

/** Wisphub, the database and the alerts as doubles; the payment rules are real. */
const handlerFor = ({
  customer,
  resolution = 'applying',
  registerInvoicePayment = vi.fn<WisphubPort['registerInvoicePayment']>().mockResolvedValue({}),
  lookupCustomer = async () => customer,
}: {
  customer: WisphubCustomer
  resolution?: string | null
  registerInvoicePayment?: WisphubPort['registerInvoicePayment']
  lookupCustomer?: WisphubPort['lookupCustomer']
}) => {
  const receipts = {
    loadHeld: vi.fn(async () => ({
      conversationId: 'conversation-1',
      references: ['M20902248'],
      mediaId: 'media-1',
      resolution,
    })),
    recordAttempt: vi.fn(async () => ({ attemptId: 'attempt-1' })),
    settleAttempt: vi.fn(async () => undefined),
    markApplied: vi.fn(async () => undefined),
    failApplying: vi.fn(async () => undefined),
  }

  const conversations = {
    storeOperatorReply: vi.fn(async () => 'message-1'),
    handBackToAgent: vi.fn(async () => undefined),
  }

  const wisphub: WisphubPort = {
    lookupCustomer,
    getProfile: async () => ({ saldo: '0' }),
    registerInvoicePayment,
    updateBalance: vi.fn().mockResolvedValue({}),
  }

  const runtime = { runtimeConfig: { dryRun: false }, wisphub } as unknown as TenantRuntime

  const handler = new ApplyHeldReceiptJobHandler(
    receipts as unknown as ReceiptRepository,
    conversations as unknown as ConversationRepository,
    {
      listAll: async () => [{ id: METHOD_ID, wisphubId: '45560' }],
    } as unknown as PaymentMethodRepository,
    { load: async () => runtime } as unknown as TenantRuntimeService,
    {
      forTenant: () => ({ notifyTenantAdmin: async () => undefined }),
    } as unknown as TenantAdminAlertService,
  )

  return { handler, receipts, conversations, registerInvoicePayment }
}

describe('ApplyHeldReceiptJobHandler', () => {
  it('registers the payment, closes the receipt and confirms to the customer', async () => {
    const { handler, receipts, conversations, registerInvoicePayment } = handlerFor({
      customer: customerOwing(50_000),
    })

    const outcome = await handler.run(PAYLOAD)

    expect(registerInvoicePayment).toHaveBeenCalledWith(
      900,
      expect.objectContaining({ total_cobrado: 50_000, forma_pago: '45560' }),
    )
    expect(receipts.recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'invoice_payment', receiptId: RECEIPT_ID }),
    )
    expect(receipts.settleAttempt).toHaveBeenCalledWith(
      TENANT_ID,
      'attempt-1',
      expect.objectContaining({ state: 'confirmed' }),
    )
    expect(receipts.markApplied).toHaveBeenCalledWith(TENANT_ID, RECEIPT_ID)
    expect(conversations.storeOperatorReply).toHaveBeenCalledWith(
      TENANT_ID,
      'conversation-1',
      expect.stringContaining('Si tu servicio estaba suspendido, ya está activo.'),
    )
    expect(conversations.handBackToAgent).toHaveBeenCalledWith(TENANT_ID, 'conversation-1')
    expect(outcome).toEqual({
      confirmation: { conversationId: 'conversation-1', messageId: 'message-1' },
    })
  })

  it('credits a customer who owes nothing, without the reactivation sentence', async () => {
    const { handler, receipts, conversations } = handlerFor({ customer: customerOwing(0) })

    await handler.run(PAYLOAD)

    expect(receipts.recordAttempt).toHaveBeenCalledWith(expect.objectContaining({ kind: 'credit' }))
    expect(conversations.storeOperatorReply).toHaveBeenCalledWith(
      TENANT_ID,
      'conversation-1',
      expect.not.stringContaining('suspendido'),
    )
  })

  it('puts the receipt back in Pendientes with the reason when Wisphub refuses', async () => {
    const { handler, receipts, conversations } = handlerFor({ customer: customerOwing(80_000) })

    const outcome = await handler.run(PAYLOAD)

    expect(receipts.failApplying).toHaveBeenCalledWith(TENANT_ID, RECEIPT_ID, expect.any(String))
    expect(receipts.markApplied).not.toHaveBeenCalled()
    expect(conversations.storeOperatorReply).not.toHaveBeenCalled()
    expect(outcome).toEqual({})
  })

  /**
   * Some invoices may have landed. The receipt goes back with a warning to
   * check Wisphub, never as a plain failure an operator would just retry.
   */
  it('warns to check Wisphub when an invoice call fails halfway', async () => {
    const { handler, receipts } = handlerFor({
      customer: customerOwing(50_000),
      registerInvoicePayment: vi
        .fn<WisphubPort['registerInvoicePayment']>()
        .mockRejectedValue(new Error('timeout')),
    })

    await handler.run(PAYLOAD)

    expect(receipts.markApplied).not.toHaveBeenCalled()
    expect(receipts.failApplying).toHaveBeenCalledWith(
      TENANT_ID,
      RECEIPT_ID,
      expect.stringContaining('Revísalo en Wisphub'),
    )
  })

  it('records an unknown outcome when Wisphub stops answering mid-payment', async () => {
    const { handler, receipts } = handlerFor({
      customer: customerOwing(50_000),
      lookupCustomer: vi
        .fn<WisphubPort['lookupCustomer']>()
        .mockRejectedValue(new Error('socket hang up')),
    })

    // Two documents skip the credit check, so the failing lookup happens inside
    // the payment, after the attempt row exists.
    await handler.run({ ...PAYLOAD, documents: '91290838, 63360746' })

    expect(receipts.settleAttempt).toHaveBeenCalledWith(
      TENANT_ID,
      'attempt-1',
      expect.objectContaining({ state: 'unknown' }),
    )
    expect(receipts.failApplying).toHaveBeenCalledWith(
      TENANT_ID,
      RECEIPT_ID,
      expect.stringContaining('Revísalo en Wisphub'),
    )
  })

  it('returns the receipt untouched when the customer cannot be looked up', async () => {
    const { handler, receipts } = handlerFor({
      customer: customerOwing(50_000),
      lookupCustomer: vi
        .fn<WisphubPort['lookupCustomer']>()
        .mockRejectedValue(new Error('socket hang up')),
    })

    await handler.run(PAYLOAD)

    expect(receipts.recordAttempt).not.toHaveBeenCalled()
    expect(receipts.failApplying).toHaveBeenCalledWith(
      TENANT_ID,
      RECEIPT_ID,
      expect.stringContaining('No se registró nada'),
    )
  })

  it('does nothing for a receipt the API did not mark as applying', async () => {
    const { handler, receipts } = handlerFor({ customer: customerOwing(50_000), resolution: null })

    const outcome = await handler.run(PAYLOAD)

    expect(outcome).toEqual({ skipped: 'not-applying' })
    expect(receipts.recordAttempt).not.toHaveBeenCalled()
  })
})
