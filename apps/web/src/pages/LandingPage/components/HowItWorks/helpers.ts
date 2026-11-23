import { ConversationScene } from './components/ConversationScene'
import { HandoffScene } from './components/HandoffScene'
import { PaymentsScene } from './components/PaymentsScene'
import { ReceiptScene } from './components/ReceiptScene'

/** The steps of the section, each with the scene that illustrates it. */
export const STEPS = [
  {
    number: '01',
    title: 'El cliente escribe por WhatsApp',
    body: 'Consulta su saldo o envía la foto del comprobante. El agente responde con la información de su cuenta en Wisphub.',
    Scene: ConversationScene,
  },
  {
    number: '02',
    title: 'El agente valida el comprobante',
    body: 'Identifica el monto, la referencia, la fecha y la entidad, y verifica el comprobante antes de registrar el pago.',
    Scene: ReceiptScene,
  },
  {
    number: '03',
    title: 'El pago se registra una sola vez',
    body: 'El agente aplica el pago a la factura correspondiente en Wisphub. Si la referencia ya fue registrada, no la aplica de nuevo.',
    Scene: PaymentsScene,
  },
  {
    number: '04',
    title: 'Un asesor interviene cuando hace falta',
    body: 'Si el cliente solicita atención personal o el caso requiere revisión, la conversación pasa a tu equipo con una notificación en el panel y por WhatsApp.',
    Scene: HandoffScene,
  },
] as const
