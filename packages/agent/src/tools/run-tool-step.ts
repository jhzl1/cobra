import { SKIPPED_TOOL_RESULT } from '../turn/steering'
import type { MessagingPort } from '../types'
import type { ToolDeps } from './index'

/**
 * The wrapper every tool goes through: steering first, then the two step writes.
 *
 * A skipped tool still writes its step, with status `skipped`. That row is what
 * the verification in PLAN.md looks for after sending a second document
 * mid-turn.
 */
export const runToolStep = async <T>({
  deps,
  toolName,
  toolCallId,
  input,
  execute,
}: {
  deps: ToolDeps
  toolName: string
  toolCallId: string
  input: unknown
  execute: () => Promise<T>
}): Promise<T | { skipped: string }> => {
  if (await deps.steering.shouldSkipNextTool()) {
    const stepId = await deps.steps.start({ kind: 'tool', name: toolName, toolCallId, input })
    await deps.steps.finish(stepId, { status: 'skipped', output: { skipped: SKIPPED_TOOL_RESULT } })

    return { skipped: SKIPPED_TOOL_RESULT }
  }

  const stepId = await deps.steps.start({ kind: 'tool', name: toolName, toolCallId, input })

  try {
    const output = await execute()
    await deps.steps.finish(stepId, { status: 'done', output })

    return output
  } catch (error) {
    await deps.steps.finish(stepId, { status: 'error', error: describeError(error) })

    throw error
  }
}

/**
 * Alerts are best-effort by contract.
 *
 * In n8n, execution 38986 died red because the alert node referenced a node
 * that had not run — the customer already had their confirmation and the run
 * was marked failed anyway. Nothing about notifying the administrator may take
 * the turn down.
 */
export const notifyQuietly = async (
  messaging: MessagingPort,
  message: string,
  mediaId: string | null,
): Promise<void> => {
  try {
    await messaging.notifyTenantAdmin(message, mediaId)
  } catch {
    // Swallowed on purpose. The failure is visible in the run's steps.
  }
}

export const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)
