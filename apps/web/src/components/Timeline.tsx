import { Accordion, AccordionItem, Chip, Spinner } from '@heroui/react'
import type { AgentRun, AgentStep } from '@cobra/contracts'

const STEP_COLOR: Record<AgentStep['status'], 'default' | 'success' | 'danger' | 'warning'> = {
  running: 'default',
  done: 'success',
  error: 'danger',
  skipped: 'warning',
}

const STEP_LABEL: Record<AgentStep['status'], string> = {
  running: 'Corriendo',
  done: 'Listo',
  error: 'Error',
  skipped: 'Saltada',
}

/**
 * What the agent is doing, step by step, while it does it.
 *
 * A step appears as `running` the moment its tool is launched and turns into its
 * result when it returns — that is why the recorder writes twice per tool. Fed
 * from the model's end-of-step callback alone, everything would land at once at
 * the end and there would be nothing live about it.
 */
export const Timeline = ({ runs }: { runs: AgentRun[] }) => {
  if (!runs.length) {
    return (
      <p className="text-default-500 p-4 text-sm">Todavía no hay turnos en esta conversación.</p>
    )
  }

  return (
    <Accordion selectionMode="multiple" defaultExpandedKeys={[runs[0]?.id ?? '']}>
      {runs.map((run) => (
        <AccordionItem
          key={run.id}
          aria-label={`Turno ${run.id}`}
          title={
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {new Date(run.startedAt).toLocaleString('es-CO', { hour12: true })}
              </span>
              <Chip size="sm" variant="flat" color={run.status === 'error' ? 'danger' : 'default'}>
                {run.status}
              </Chip>
              {run.status === 'running' && <Spinner size="sm" />}
            </div>
          }
        >
          <ol className="flex flex-col gap-2">
            {run.steps
              .slice()
              .sort((a, b) => a.seq - b.seq)
              .map((step) => (
                <li key={step.id} className="border-default-200 rounded-medium border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {step.kind} · {step.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {step.durationMs !== null && (
                        <span className="text-default-500 text-xs">{step.durationMs} ms</span>
                      )}
                      <Chip size="sm" variant="flat" color={STEP_COLOR[step.status]}>
                        {STEP_LABEL[step.status]}
                      </Chip>
                    </div>
                  </div>

                  {(step.input || step.output || step.error) && (
                    <details className="mt-1">
                      <summary className="text-default-500 cursor-pointer text-xs">
                        Ver argumentos y resultado
                      </summary>
                      <pre className="bg-default-100 mt-1 overflow-x-auto rounded p-2 text-xs">
                        {JSON.stringify(
                          { input: step.input, output: step.output, error: step.error },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
          </ol>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
