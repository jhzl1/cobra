import { type Tool, tool } from 'ai'
import { z } from 'zod'
import type { ToolDeps } from './index'
import { runToolStep } from './run-tool-step'

export const lookupCustomerTool = (deps: ToolDeps): Tool =>
  tool({
    description:
      'Busca un cliente por su número de documento y devuelve si existe, sus facturas pendientes, el total que debe y las cuentas donde puede pagar. Una llamada por documento.',
    inputSchema: z.object({
      document: z
        .string()
        .min(1)
        .describe('El número de documento del cliente, sin puntos ni espacios'),
    }),
    execute: (input, options) =>
      runToolStep({
        deps,
        toolName: 'LookupCustomer',
        toolCallId: options.toolCallId,
        input,
        execute: async () => {
          const customer = await deps.wisphub.lookupCustomer(input.document)

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
        },
      }),
  })
