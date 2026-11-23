import { type Tool, tool } from 'ai'
import { z } from 'zod'
import { applyCredit } from '../payments/apply-credit'
import type { ToolDeps } from './index'
import { describeError, notifyQuietly, runToolStep } from './run-tool-step'

export const applyCreditTool = (deps: ToolDeps): Tool =>
  tool({
    description:
      'Abona el monto del comprobante como saldo a favor del cliente en Wisphub. Solo cuando el cliente NO tiene facturas pendientes y ya aceptó dejarlo a favor.',
    inputSchema: z.object({
      document: z.string().min(1),
      amount: z.number(),
      reference: z.string(),
      paymentMethodId: z.string(),
    }),
    execute: (input, options) =>
      runToolStep({
        deps,
        toolName: 'ApplyCredit',
        toolCallId: options.toolCallId,
        input,
        execute: async () => {
          const { attemptId } = await deps.receipts.recordPaymentAttempt({
            tenantId: deps.tenantId,
            conversationId: deps.conversationId,
            receiptId: deps.pendingReceipt?.id ?? null,
            kind: 'credit',
            documents: [input.document],
            amount: input.amount,
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
        },
      }),
  })
