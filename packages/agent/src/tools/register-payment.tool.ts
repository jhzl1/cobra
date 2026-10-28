import { type Tool, tool } from 'ai'
import { z } from 'zod'
import { registerPayment } from '../payments/register-payment'
import type { ToolDeps } from './index'
import { describeError, notifyQuietly, runToolStep } from './run-tool-step'

export const registerPaymentTool = (deps: ToolDeps): Tool =>
  tool({
    description:
      'Registra el pago contra TODAS las facturas pendientes del cliente en Wisphub. Recibe el documento (o varios separados por coma). Con varias cuentas todas deben tener deuda y el monto debe ser exactamente la suma. Con una sola cuenta, el excedente queda como saldo a favor.',
    inputSchema: z.object({
      documents: z.string().min(1),
      amount: z.number(),
      reference: z.string(),
      paymentMethodId: z.string(),
    }),
    execute: (input, options) =>
      runToolStep({
        deps,
        toolName: 'RegisterPayment',
        toolCallId: options.toolCallId,
        input,
        execute: async () => {
          /**
           * The attempt row goes in before Wisphub is touched. The failure that
           * costs money is not the double call, it is the timeout after success:
           * the POST lands, the answer is lost, and nobody knows whether the
           * customer was charged. With the row already written, that ends as
           * `unknown` and reconciliation resolves it.
           */
          const { attemptId } = await deps.receipts.recordPaymentAttempt({
            tenantId: deps.tenantId,
            conversationId: deps.conversationId,
            receiptId: deps.pendingReceipt?.id ?? null,
            kind: 'invoice_payment',
            documents: input.documents.split(',').map((value) => value.trim()),
            amount: input.amount,
            references: input.reference.split(',').map((value) => value.trim()),
          })

          try {
            const result = await registerPayment(input, { wisphub: deps.wisphub })

            await deps.receipts.settlePaymentAttempt(attemptId, {
              state: result.success ? 'confirmed' : 'failed',
              invoiceIds: result.invoiceIds,
              failedInvoiceIds: result.failedInvoiceIds,
              wisphubResponse: { status: result.status, message: result.message },
            })

            if (result.adminMessage) {
              await notifyQuietly(deps.messaging, result.adminMessage, deps.mediaId)
            }

            const {
              adminMessage: _adminMessage,
              invoiceIds: _invoiceIds,
              failedInvoiceIds: _failed,
              ...forModel
            } = result

            return forModel
          } catch (error) {
            /**
             * Network failure or timeout. Not `failed`: we do not know. The agent
             * is told to say the receipt is under verification, never that it
             * failed, so the customer is not pushed into paying twice.
             */
            await deps.receipts.settlePaymentAttempt(attemptId, {
              state: 'unknown',
              error: describeError(error),
            })

            await notifyQuietly(
              deps.messaging,
              `URGENTE: estado de pago desconocido\nDocumento(s): ${input.documents}\nMonto: $${input.amount}\nRef: ${input.reference}\nMotivo: ${describeError(error)}`,
              deps.mediaId,
            )

            throw error
          }
        },
      }),
  })
