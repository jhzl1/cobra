import { type Tool, tool } from 'ai'
import { z } from 'zod'
import type { ToolDeps } from './index'
import { notifyQuietly, runToolStep } from './run-tool-step'

/**
 * One tool with a flag instead of `NotifyAdmin` and `NotifyAdminWithImage`. With
 * two names the model had to pick the right one, and the image only exists when
 * the customer sent one this turn: a flag pointing at a missing image degrades
 * to a text alert instead of to a wrong tool call.
 *
 * The flag defaults to false rather than being required. This is the escalation
 * path of last resort, and a call that forgets the flag must still reach the
 * administrator: losing the image costs less than losing the alert.
 */
export const notifyAdminTool = (deps: ToolDeps): Tool =>
  tool({
    description:
      'Envía un mensaje de alerta por WhatsApp al administrador. Úsalo cuando rechaces un comprobante, escales un caso o no sepas cómo seguir. Con attachImage en true, el mensaje va como pie de foto de la imagen del comprobante.',
    inputSchema: z.object({
      message: z
        .string()
        .min(1)
        .describe(
          'Mensaje de alerta para el administrador: motivo del rechazo o sospecha, teléfono del cliente, referencia del comprobante y monto',
        ),
      attachImage: z
        .boolean()
        .default(false)
        .describe(
          'true para adjuntar la imagen del comprobante que el cliente envió en este turno. Si no envió imagen, la alerta va solo con el texto.',
        ),
    }),
    execute: (input, options) =>
      runToolStep({
        deps,
        toolName: 'NotifyAdmin',
        toolCallId: options.toolCallId,
        input,
        execute: async () => {
          const mediaId = input.attachImage ? deps.mediaId : null
          await notifyQuietly(deps.messaging, input.message, mediaId)

          return { sent: true }
        },
      }),
  })
