import { ChevronRightIcon } from 'lucide-react'
import type { AgentStep } from '@cobra/contracts'
import { cn } from '~/lib/utils'
import { formatSeconds } from '~/utils/formatters'
import { KIND_LABEL, STATUS_LABEL, STATUS_MARK, STATUS_TONE } from '../helpers'

interface TimelineStepProps {
  step: AgentStep
}

export const TimelineStep = ({ step }: TimelineStepProps) => {
  const hasDetail = Boolean(step.input || step.output || step.error)

  return (
    <li className="grid grid-cols-[8px_minmax(0,1fr)_auto] items-baseline gap-x-2.5 border-t border-dashed px-4 py-2 font-mono text-xs">
      <span
        aria-hidden
        className={cn('size-2 self-center rounded-full', STATUS_MARK[step.status])}
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
