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

/** Tools are most steps, so only the other kinds say what they are. */
export const KIND_LABEL: Partial<Record<AgentStep['kind'], string>> = {
  normalize: 'normalización',
  media: 'archivo',
  vision: 'lectura de imagen',
  validation: 'validación',
  llm: 'modelo',
  send: 'envío',
}
