import type { AgentRun, AgentStep } from '@cobra/contracts'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
import { cn } from '~/lib/utils'

type Status = AgentStep['status']

/** A state is a coloured word, once; the log has no badges. */
const STATUS_TONE: Record<Status, string> = {
  running: 'text-info',
  done: 'text-success',
  error: 'text-destructive',
  skipped: 'text-muted-foreground',
}

const STATUS_LABEL: Record<Status, string> = {
  running: 'en curso',
  done: 'listo',
  error: 'falló',
  skipped: 'omitido',
}

/** Tools are most steps, so only the other kinds say what they are. */
const KIND_LABEL: Partial<Record<AgentStep['kind'], string>> = {
  normalize: 'normalización',
  media: 'archivo',
  vision: 'lectura de imagen',
  validation: 'validación',
  llm: 'modelo',
  send: 'envío',
}

const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

const seconds = (ms: number): string =>
  `${(ms / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} s`

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
      {runs.map((run) => {
        const elapsed = run.finishedAt
          ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
          : null

        return (
          <AccordionItem key={run.id} value={run.id}>
            <AccordionTrigger className="items-center rounded-none px-4 py-2.5 hover:bg-accent/60 hover:no-underline focus-visible:bg-accent focus-visible:ring-0">
              <span className="flex flex-1 items-baseline gap-3 font-mono text-xs">
                <span className="text-foreground">{clock(run.startedAt)}</span>
                <span className={STATUS_TONE[run.status]}>
                  {run.trigger === 'manual_replay' ? 'reenviado · ' : ''}
                  {STATUS_LABEL[run.status]}
                </span>
                {elapsed !== null && (
                  <span className="ml-auto text-muted-foreground">{seconds(elapsed)}</span>
                )}
              </span>
            </AccordionTrigger>

            <AccordionContent className="pb-2">
              <ol className="flex flex-col">
                {run.steps
                  .slice()
                  .sort((a, b) => a.seq - b.seq)
                  .map((step) => (
                    <Step key={step.id} step={step} />
                  ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}

const Step = ({ step }: { step: AgentStep }) => {
  const hasDetail = Boolean(step.input || step.output || step.error)

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-t border-dashed px-4 py-2 font-mono text-xs">
      <span
        className={cn(
          'truncate',
          step.status === 'skipped' ? 'text-muted-foreground line-through' : 'text-foreground',
        )}
      >
        {step.name}
      </span>

      <span className={step.status === 'done' ? 'text-muted-foreground' : STATUS_TONE[step.status]}>
        {step.status === 'done' && step.durationMs !== null
          ? seconds(step.durationMs)
          : STATUS_LABEL[step.status]}
      </span>

      {KIND_LABEL[step.kind] && (
        <span className="text-muted-foreground">{KIND_LABEL[step.kind]}</span>
      )}

      {step.error && <p className="col-span-2 mt-1 text-destructive">{step.error}</p>}

      {hasDetail && (
        <details className="group col-span-2 mt-1">
          <summary className="cursor-pointer text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground">
            argumentos y resultado
          </summary>
          <pre className="mt-1.5 max-h-72 overflow-auto rounded-md border bg-background p-2 text-[11px] leading-relaxed">
            {JSON.stringify({ input: step.input, output: step.output, error: step.error }, null, 2)}
          </pre>
        </details>
      )}
    </li>
  )
}
