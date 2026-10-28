import { type Tool, tool } from 'ai'
import { z } from 'zod'
import type { ToolDeps } from './index'
import { runToolStep } from './run-tool-step'

export const checkPendingReceiptTool = (deps: ToolDeps): Tool =>
  tool({
    description:
      'Respaldo. Dice si este chat tiene un comprobante pendiente sin registrar. El sistema ya la ejecuta antes de cada turno: llámala SOLO si el bloque COMPROBANTE dice que la consulta falló. No recibe parámetros.',
    inputSchema: z.object({}),
    execute: (input, options) =>
      runToolStep({
        deps,
        toolName: 'CheckPendingReceipt',
        toolCallId: options.toolCallId,
        input,
        execute: async () => {
          const result = await deps.receipts.checkPendingReceipt(deps.conversationId)

          return {
            hasPendingReceipt: result.hasPendingReceipt,
            message: result.message,
            ...(result.receipt
              ? {
                  amount: result.receipt.amount,
                  reference: result.receipt.reference,
                  paymentMethodId: result.receipt.wisphubPaymentMethodId,
                  destinationMethod: result.receipt.destinationMethod,
                }
              : {}),
          }
        },
      }),
  })
