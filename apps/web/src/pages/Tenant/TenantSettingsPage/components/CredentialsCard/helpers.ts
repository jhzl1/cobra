import { saveCredentialSchema } from '@cobra/contracts'
import type { ProviderSpec } from './types'

/**
 * Only the secret: the provider comes from the row that opened the dialog, not
 * from a field. TanStack validates the whole form at once, so the schema has to
 * cover every default value.
 */
export const credentialFormSchema = saveCredentialSchema.pick({ secret: true })

export const PROVIDERS: ProviderSpec[] = [
  {
    provider: 'dualhook',
    name: 'WhatsApp (Dualhook)',
    purpose: 'Envía los mensajes desde el número de la empresa y descarga los comprobantes.',
    secretLabel: 'Clave de API de Dualhook',
    secretHint: 'En el panel de Dualhook, dentro de la conexión del número. Empieza por dh_live_.',
  },
  {
    provider: 'openrouter',
    name: 'OpenRouter',
    purpose: 'Ejecuta el agente y la lectura de comprobantes.',
    secretLabel: 'Clave de API',
    secretHint: 'En OpenRouter, sección Keys. Empieza por sk-or-.',
  },
  {
    provider: 'wisphub',
    name: 'Wisphub',
    purpose: 'Consulta la deuda de los clientes y registra los pagos.',
    secretLabel: 'Clave de API',
    secretHint: 'En Wisphub: Configuración → API.',
  },
]
