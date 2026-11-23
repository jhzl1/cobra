import type { SetupStep } from '@cobra/contracts'

interface StepCopy {
  title: string
  /** What it is for, in one line. Not what to click — that is the button. */
  why: string
  action: string
  to: '/$tenantId/settings'
}

export const SETUP_STEP_COPY: Record<SetupStep['id'], StepCopy> = {
  credentials: {
    title: 'Configurar las credenciales',
    why: 'Sin las tres credenciales, el agente no puede recibir mensajes, generar respuestas ni registrar pagos.',
    action: 'Ir a Credenciales',
    to: '/$tenantId/settings',
  },
  number: {
    title: 'Conectar el número de WhatsApp',
    why: 'Al registrarlo, se genera la URL a la que llegarán sus mensajes.',
    action: 'Conectar número',
    to: '/$tenantId/settings',
  },
  webhook: {
    title: 'Configurar la URL en Dualhook',
    why: 'Este paso se realiza fuera de Wispay. Se marca como completado cuando llega el primer mensaje.',
    action: 'Ver la URL',
    to: '/$tenantId/settings',
  },
  paymentMethods: {
    title: 'Registrar las cuentas de recaudo',
    why: 'El agente verifica contra ellas la cuenta de cada comprobante. Si no hay ninguna registrada, todos los comprobantes se retienen.',
    action: 'Agregar cuenta',
    to: '/$tenantId/settings',
  },
}
