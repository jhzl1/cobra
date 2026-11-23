import type { AgentRun, Message } from '@cobra/contracts'

/**
 * A turn stuck in `running` — a worker that died mid-turn never closes its
 * run — must not show the agent thinking forever. Past the turn's own expiry
 * in the queue, it is not running anymore whatever the row says.
 */
const RUN_STALE_AFTER_MS = 2 * 60 * 1000

export const isRunInProgress = (run: AgentRun | undefined): boolean =>
  run?.status === 'running' && Date.now() - new Date(run.startedAt).getTime() < RUN_STALE_AFTER_MS

export const AUTHOR_LABEL: Record<Message['author'], string> = {
  contact: 'Cliente',
  agent: 'Agente',
  operator: 'Asesor',
}
