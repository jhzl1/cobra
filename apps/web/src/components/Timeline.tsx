import type { AgentRun, AgentStep } from '@cobra/contracts'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
import { Badge, type BadgeTone } from '~/components/ui/badge'
import { Spinner } from '~/components/ui/spinner'

const STEP_TONE: Record<AgentStep['status'], BadgeTone> = {
  running: 'default',
  done: 'success',
  error: 'destructive',
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
      <p className="p-4 text-sm text-muted-foreground">
        Todavía no hay turnos en esta conversación.
      </p>
    )
  }

  return (
    // `defaultValue` is only read on mount, and this component is not unmounted
    // when the operator opens another conversation — so without the key the new
    // runs arrive against the old default and nothing is expanded.
    <Accordion key={runs[0]?.id} type="multiple" defaultValue={[runs[0]?.id ?? '']}>
      {runs.map((run) => (
        <AccordionItem key={run.id} value={run.id}>
          <AccordionTrigger>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {new Date(run.startedAt).toLocaleString('es-CO', { hour12: true })}
              </span>
              <Badge variant={run.status === 'error' ? 'destructive' : 'default'}>
                {run.status}
              </Badge>
              {run.status === 'running' && <Spinner />}
            </div>
          </AccordionTrigger>

          <AccordionContent>
            <ol className="flex flex-col gap-2">
              {run.steps
                .slice()
                .sort((a, b) => a.seq - b.seq)
                .map((step) => (
                  <li key={step.id} className="rounded-lg border border-border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {step.kind} · {step.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {step.durationMs !== null && (
                          <span className="text-xs text-muted-foreground">
                            {step.durationMs} ms
                          </span>
                        )}
                        <Badge variant={STEP_TONE[step.status]}>{STEP_LABEL[step.status]}</Badge>
                      </div>
                    </div>

                    {(step.input || step.output || step.error) && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-muted-foreground">
                          Ver argumentos y resultado
                        </summary>
                        <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
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
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
