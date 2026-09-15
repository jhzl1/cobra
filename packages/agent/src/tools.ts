import { type ToolSet, tool } from 'ai'
import { z } from 'zod'
import type {
  MessagingPort,
  PaymentMethod,
  PendingReceipt,
  ReceiptPort,
  StepRecorder,
  WisphubPort,
} from './types'
import { applyCredit } from './apply-credit'
import { registerPayment } from './register-payment'
import { SKIPPED_TOOL_RESULT, Steering } from './steering'

export interface ToolDeps {
  tenantId: string
  conversationId: string
  wisphub: WisphubPort
  receipts: ReceiptPort
  messaging: MessagingPort
  steps: StepRecorder
  steering: Steering
  /** The tenant's payment methods, for the zone of the customer being looked up. */
  listPaymentMethods(zone: string | null): Promise<PaymentMethod[]>
  /** The receipt this turn is working on, when there is one. */
  pendingReceipt: PendingReceipt | null
  /** The image of this turn, for the alert that carries it. */
  mediaId: string | null
}

/**
 * The six tools, each wrapped twice: once by the step recorder, once by the
 * steering check.
 *
 * Both writes of a step happen here rather than in the AI SDK's end-of-step
 * callback. That callback fires when the step is already over, so a timeline fed
 * from it shows finished calls only — the panel never displays "llamando a
 * LookupCustomer…", which is the whole point of it being live.
 *
 * Annotated as `ToolSet` rather than left to inference: the inferred type
 * reaches into `@ai-sdk/provider-utils` internals that the emitted .d.ts cannot
 * name, and the declaration build fails with TS2883.
 */
export const buildTools = (deps: ToolDeps): ToolSet => ({
  LookupCustomer: tool({
    description:
      'Busca un cliente por su número de documento y devuelve si existe, sus facturas pendientes, el total que debe y las cuentas donde puede pagar. Una llamada por documento.',
    inputSchema: z.object({
      documento: z.string().min(1).describe('El número de documento del cliente, sin puntos ni espacios'),
    }),
    execute: (input, options) =>
      run(deps, 'LookupCustomer', options.toolCallId, input, async () => {
        const customer = await deps.wisphub.lookupCustomer(input.documento)

        if (!customer.found) return customer

        const methods = await deps.listPaymentMethods(customer.zone ?? null)

        return {
          ...customer,
          // Only these two fields: the addresses are read to the customer, and
          // wisphubId is internal.
          paymentMethods: methods.map((method) => ({
            entityName: method.entityName,
            paymentAddress: method.paymentAddress,
          })),
        }
      }),
  }),

  RegisterPayment: tool({
    description:
      'Registra el pago contra TODAS las facturas pendientes del cliente en Wisphub. Recibe el documento (o varios separados por coma). Con varias cuentas todas deben tener deuda y el monto debe ser exactamente la suma. Con una sola cuenta, el excedente queda como saldo a favor.',
    inputSchema: z.object({
      documentos: z.string().min(1),
      monto: z.number(),
      reference: z.string(),
      fecha_pago: z.string(),
      forma_pago: z.string(),
    }),
    execute: (input, options) =>
      run(deps, 'RegisterPayment', options.toolCallId, input, async () => {
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
          documents: input.documentos.split(',').map((value) => value.trim()),
          amount: input.monto,
          references: input.reference.split(',').map((value) => value.trim()),
        })

        try {
          const result = await registerPayment(input, { wisphub: deps.wisphub })

          await deps.receipts.settlePaymentAttempt(attemptId, {
            state: result.success ? 'confirmed' : 'failed',
            invoiceIds: result.invoiceIds,
            failedInvoiceIds: result.failedInvoiceIds,
            wisphubResponse: { estado: result.estado, message: result.message },
          })

          if (result.adminMessage) {
            await notifyQuietly(deps.messaging, result.adminMessage, deps.mediaId)
          }

          const { adminMessage: _adminMessage, invoiceIds: _invoiceIds, failedInvoiceIds: _failed, ...forModel } =
            result

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
            `URGENTE: estado de pago desconocido\nDocumento(s): ${input.documentos}\nMonto: $${input.monto}\nRef: ${input.reference}\nMotivo: ${describeError(error)}`,
            deps.mediaId,
          )

          throw error
        }
      }),
  }),

  ApplyCredit: tool({
    description:
      'Abona el monto del comprobante como saldo a favor del cliente en Wisphub. Solo cuando el cliente NO tiene facturas pendientes y ya aceptó dejarlo a favor.',
    inputSchema: z.object({
      documento: z.string().min(1),
      abono: z.number(),
      reference: z.string(),
      fecha_pago: z.string(),
      forma_pago: z.string(),
    }),
    execute: (input, options) =>
      run(deps, 'ApplyCredit', options.toolCallId, input, async () => {
        const { attemptId } = await deps.receipts.recordPaymentAttempt({
          tenantId: deps.tenantId,
          conversationId: deps.conversationId,
          receiptId: deps.pendingReceipt?.id ?? null,
          kind: 'credit',
          documents: [input.documento],
          amount: input.abono,
          references: input.reference.split(',').map((value) => value.trim()),
        })

        try {
          const result = await applyCredit(input, { wisphub: deps.wisphub })

          await deps.receipts.settlePaymentAttempt(attemptId, {
            state: result.success ? 'confirmed' : 'failed',
            wisphubResponse: { message: result.message },
          })

          if (result.adminMessage) {
            await notifyQuietly(deps.messaging, result.adminMessage, deps.mediaId)
          }

          const { adminMessage: _adminMessage, ...forModel } = result

          return forModel
        } catch (error) {
          await deps.receipts.settlePaymentAttempt(attemptId, {
            state: 'unknown',
            error: describeError(error),
          })

          throw error
        }
      }),
  }),

  CheckPendingReceipt: tool({
    description:
      'Respaldo. Dice si este chat tiene un comprobante pendiente sin registrar. El sistema ya la ejecuta antes de cada turno: llámala SOLO si el bloque COMPROBANTE dice que la consulta falló. No recibe parámetros.',
    inputSchema: z.object({}),
    execute: (input, options) =>
      run(deps, 'CheckPendingReceipt', options.toolCallId, input, async () => {
        const result = await deps.receipts.checkPendingReceipt(deps.conversationId)

        return {
          has_pending_receipt: result.hasPendingReceipt,
          message: result.message,
          ...(result.receipt
            ? {
                amount: result.receipt.amount,
                reference: result.receipt.reference,
                forma_pago: result.receipt.formaPago,
                fecha_pago: result.receipt.fechaPago,
                destinationMethod: result.receipt.destinationMethod,
              }
            : {}),
        }
      }),
  }),

  NotifyAdmin: tool({
    description:
      'Envía un mensaje de alerta por WhatsApp al administrador. Úsalo cuando rechaces un comprobante, escales un caso o no sepas cómo seguir y no haya imagen que adjuntar.',
    inputSchema: z.object({
      message: z
        .string()
        .min(1)
        .describe(
          'Mensaje de alerta para el administrador: motivo del rechazo o sospecha, teléfono del cliente, referencia del comprobante y monto',
        ),
    }),
    execute: (input, options) =>
      run(deps, 'NotifyAdmin', options.toolCallId, input, async () => {
        await notifyQuietly(deps.messaging, input.message, null)

        return { sent: true }
      }),
  }),

  NotifyAdminWithImage: tool({
    description:
      'Envía al administrador la imagen del comprobante con un texto de alerta como pie de foto. Úsalo cuando rechaces un comprobante y el cliente haya enviado una imagen.',
    inputSchema: z.object({
      message: z.string().min(1),
    }),
    execute: (input, options) =>
      run(deps, 'NotifyAdminWithImage', options.toolCallId, input, async () => {
        await notifyQuietly(deps.messaging, input.message, deps.mediaId)

        return { sent: true }
      }),
  }),
})


/**
 * The wrapper every tool goes through: steering first, then the two step writes.
 *
 * A skipped tool still writes its step, with status `skipped`. That row is what
 * the verification in PLAN.md looks for after sending a second document
 * mid-turn.
 */
const run = async <T>(
  deps: ToolDeps,
  name: string,
  toolCallId: string,
  input: unknown,
  execute: () => Promise<T>,
): Promise<T | { skipped: string }> => {
  if (await deps.steering.shouldSkipNextTool()) {
    const stepId = await deps.steps.start({ kind: 'tool', name, toolCallId, input })
    await deps.steps.finish(stepId, { status: 'skipped', output: { skipped: SKIPPED_TOOL_RESULT } })

    return { skipped: SKIPPED_TOOL_RESULT }
  }

  const stepId = await deps.steps.start({ kind: 'tool', name, toolCallId, input })

  try {
    const output = await execute()
    await deps.steps.finish(stepId, { status: 'done', output })

    return output
  } catch (error) {
    await deps.steps.finish(stepId, { status: 'error', error: describeError(error) })

    throw error
  }
}

/**
 * Alerts are best-effort by contract.
 *
 * In n8n, execution 38986 died red because the alert node referenced a node
 * that had not run — the customer already had their confirmation and the run
 * was marked failed anyway. Nothing about notifying the administrator may take
 * the turn down.
 */
const notifyQuietly = async (
  messaging: MessagingPort,
  message: string,
  mediaId: string | null,
): Promise<void> => {
  try {
    await messaging.notifyAdmin(message, mediaId)
  } catch {
    // Swallowed on purpose. The failure is visible in the run's steps.
  }
}

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
