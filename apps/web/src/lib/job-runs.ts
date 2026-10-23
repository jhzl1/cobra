import { type JobRun, QUEUES } from '@cobra/contracts'
import type { BadgeTone } from '~/components/ui/badge'

/** What each queue does, said the way the administrator reads it. */
const QUEUE_LABEL: Record<string, string> = {
  [QUEUES.processTurn]: 'Turno del agente',
  [QUEUES.processReceipt]: 'Lectura de comprobante',
  [QUEUES.sendMessage]: 'Envío por WhatsApp',
  [QUEUES.notifyTenantAdmin]: 'Alerta al administrador',
}

export const queueLabel = (queue: string): string => QUEUE_LABEL[queue] ?? queue

interface AttemptState {
  label: string
  tone: BadgeTone
}

/**
 * A failed attempt means two different things: one pg-boss is about to retry is
 * noise until it runs out, and one that ran out is a customer left waiting. The
 * badge says which.
 */
export const attemptStateOf = (run: JobRun): AttemptState => {
  if (run.status === 'running') return { label: 'En curso', tone: 'info' }
  if (run.status === 'done') return { label: 'Completada', tone: 'success' }
  if (run.attempt < run.maxAttempts) return { label: 'Falló, se reintenta', tone: 'warning' }

  return { label: 'Falló', tone: 'destructive' }
}

export const formatAttempt = (run: JobRun): string =>
  run.maxAttempts > 1 ? `${run.attempt} de ${run.maxAttempts}` : 'Único'

export const formatStartedAt = (iso: string): string =>
  new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
