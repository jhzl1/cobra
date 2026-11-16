import type { AgentStep } from '@cobra/contracts'

/** A state is a coloured word, once; the log has no badges. */
export const STATUS_TONE: Record<AgentStep['status'], string> = {
  running: 'text-info',
  done: 'text-success',
  error: 'text-destructive',
  skipped: 'text-muted-foreground',
}

export const STATUS_LABEL: Record<AgentStep['status'], string> = {
  running: 'en curso',
  done: 'completado',
  error: 'con error',
  skipped: 'omitido',
}

/**
 * The mark at the head of each step: filled when it settled, a dashed ring while
 * it runs, hollow when it was skipped. The shape says it without the colour.
 */
export const STATUS_MARK: Record<AgentStep['status'], string> = {
  running: 'border border-dashed border-info',
  done: 'bg-success',
  error: 'bg-destructive',
  skipped: 'border border-muted-foreground',
}

/** The agent's tools, in the words of the advisor watching rather than the code's. */
const NARRATIVE_BY_TOOL: Record<string, string> = {
  LookupCustomer: 'Consultando la cuenta del cliente en Wisphub',
  RegisterPayment: 'Registrando el pago en Wisphub',
  ApplyCredit: 'Aplicando el saldo a favor',
  CheckPendingReceipt: 'Revisando si hay un comprobante pendiente',
  NotifyAdmin: 'Avisando al administrador de la empresa',
}

const NARRATIVE_BY_KIND: Record<AgentStep['kind'], string> = {
  normalize: 'Uniendo los mensajes del cliente',
  media: 'Descargando la imagen',
  vision: 'Leyendo el comprobante',
  validation: 'Validando el comprobante',
  tool: 'Consultando una herramienta',
  llm: 'Leyendo lo que escribió el cliente',
  send: 'Enviando la respuesta',
}

/**
 * What the agent is doing right now, as a sentence. The model's step spans the
 * whole turn and the tools run inside it, so the newest running step is the
 * one in hand. Once a tool has answered, the model is writing the reply.
 */
export const narrativeOf = (steps: readonly AgentStep[]): string | null => {
  let current = steps.at(-1)

  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (steps[index]?.status === 'running') {
      current = steps[index]
      break
    }
  }

  if (!current) return null

  const hasUsedTools = steps.some((step) => step.kind === 'tool' && step.status !== 'running')

  if (current.kind === 'llm' && hasUsedTools) return 'Redactando la respuesta'

  return NARRATIVE_BY_TOOL[current.name] ?? NARRATIVE_BY_KIND[current.kind]
}

/** Tools are most steps, so only the other kinds say what they are. */
export const KIND_LABEL: Partial<Record<AgentStep['kind'], string>> = {
  normalize: 'normalización',
  media: 'archivo',
  vision: 'lectura de imagen',
  validation: 'validación',
  llm: 'modelo',
  send: 'envío',
}
