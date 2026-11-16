import type { AgentRun } from '@cobra/contracts'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion'
import { formatClock, formatSeconds } from '~/utils/formatters'
import { TimelineStep } from './components/TimelineStep'
import { STATUS_LABEL, STATUS_TONE } from './helpers'

interface TimelineProps {
  runs: AgentRun[]
}

/**
 * What the agent is doing, step by step, while it does it.
 *
 * A step appears as `running` the moment its tool is launched and turns into its
 * result when it returns — that is why the recorder writes twice per tool. Fed
 * from the model's end-of-step callback alone, everything would land at once at
 * the end and there would be nothing live about it.
 */
export const Timeline = ({ runs }: TimelineProps) => {
  if (!runs.length) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        Esta conversación aún no registra turnos del agente.
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
                <span className="text-foreground">{formatClock(run.startedAt)}</span>
                <span className={STATUS_TONE[run.status]}>
                  {run.trigger === 'manual_replay' ? 'reprocesado · ' : ''}
                  {STATUS_LABEL[run.status]}
                </span>
                {elapsed !== null && (
                  <span className="ml-auto text-muted-foreground">{formatSeconds(elapsed)}</span>
                )}
              </span>
            </AccordionTrigger>

            <AccordionContent className="pb-2">
              <ol className="flex flex-col">
                {run.steps
                  .slice()
                  .sort((a, b) => a.seq - b.seq)
                  .map((step) => (
                    <TimelineStep key={step.id} step={step} />
                  ))}
              </ol>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
