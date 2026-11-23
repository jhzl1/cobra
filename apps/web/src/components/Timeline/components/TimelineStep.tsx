import { ChevronRightIcon } from 'lucide-react'
import type { AgentStep } from '@cobra/contracts'
import { cn } from '~/lib/utils'
import { formatSeconds } from '~/utils/formatters'
import { KIND_LABEL, STATUS_LABEL, STATUS_MARK, STATUS_TONE } from '../helpers'

interface TimelineStepProps {
  step: AgentStep
  /** The step the agent is on right now: its stretch of the rail runs light. */
  isCurrent: boolean
  isFirst: boolean
  isLast: boolean
}

/**
 * One step, on a rail that joins the marks: green where a step settled, light
 * running down the one in progress, so how far the turn got reads at a glance.
 */
export const TimelineStep = ({ step, isCurrent, isFirst, isLast }: TimelineStepProps) => {
  const hasDetail = Boolean(step.input || step.output || step.error)
  const isAlone = isFirst && isLast

  return (
    <li className="relative grid grid-cols-[8px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 border-t border-dashed px-4 py-2 font-mono text-xs">
      {/* From the mark above to the one below; the first and last stop at their own mark. */}
      {!isAlone && (
        <span
          aria-hidden
          className={cn(
            'absolute left-[19px] w-0.5 overflow-hidden',
            isFirst ? 'top-3.5' : 'top-0',
            isLast ? 'h-3.5' : 'bottom-0',
            step.status === 'done' && 'bg-success/40',
            step.status === 'error' && 'bg-destructive/40',
            (step.status === 'running' || step.status === 'skipped') && 'bg-border',
          )}
        >
          {isCurrent && (
            <span className="absolute inset-x-0 top-0 h-2/5 bg-info motion-safe:animate-flow" />
          )}
        </span>
      )}

      <span
        aria-hidden
        className={cn(
          'relative z-10 size-2 self-center rounded-full bg-background',
          STATUS_MARK[step.status],
        )}
      />

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
          ? formatSeconds(step.durationMs)
          : STATUS_LABEL[step.status]}
      </span>

      {KIND_LABEL[step.kind] && (
        <span className="col-start-2 text-muted-foreground">{KIND_LABEL[step.kind]}</span>
      )}

      {step.error && <p className="col-span-2 col-start-2 mt-1 text-destructive">{step.error}</p>}

      {hasDetail && (
        <details className="group col-span-2 col-start-2 mt-1">
          {/* The browser's own triangle hidden, for the chevron the turn rows use. */}
          <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-3 transition-transform group-open:rotate-90" />
            entrada y salida
          </summary>
          <pre className="mt-1.5 max-h-72 overflow-auto rounded-md border bg-background p-2 text-[11px] leading-relaxed">
            {JSON.stringify({ input: step.input, output: step.output, error: step.error }, null, 2)}
          </pre>
        </details>
      )}
    </li>
  )
}
