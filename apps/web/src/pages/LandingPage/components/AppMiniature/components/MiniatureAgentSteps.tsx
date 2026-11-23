import { cn } from '~/lib/utils'
import type { DemoStep, StepStatus, TurnStatus } from '../types'

interface MiniatureAgentStepsProps {
  steps: Record<DemoStep, StepStatus>
  turn: TurnStatus
}

export const MiniatureAgentSteps = ({ steps, turn }: MiniatureAgentStepsProps) => {
  const STEPS = [
    {
      key: 'lookup',
      name: 'LookupCustomer',
      detail: 'Cuenta encontrada en Wisphub',
      duration: '0,6 s',
    },
    {
      key: 'check',
      name: 'CheckPendingReceipt',
      detail: 'Nequi · $ 75.000 · ref. M8841207',
      duration: '1,8 s',
    },
    {
      key: 'register',
      name: 'RegisterPayment',
      detail: 'Aplicado a la factura de noviembre',
      duration: '0,9 s',
    },
  ] as const
  const TURN_LABEL: Record<TurnStatus, { text: string; tone: string }> = {
    idle: { text: 'en espera', tone: 'text-muted-foreground' },
    running: { text: 'en curso', tone: 'text-info' },
    done: { text: 'completado · 3,3 s', tone: 'text-success' },
  }
  const started = STEPS.filter((step) => steps[step.key] !== 'pending')

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Pasos del agente
        <span className="font-mono tracking-normal normal-case">{started.length}</span>
      </div>

      <div className="flex justify-between border-b border-border px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Turno 10:42</span>
        <span className={TURN_LABEL[turn].tone}>{TURN_LABEL[turn].text}</span>
      </div>

      {started.map((step) => {
        const isRunning = steps[step.key] === 'running'

        return (
          <div
            key={step.key}
            className="slide-in-from-bottom-1.5 relative grid animate-in grid-cols-[16px_1fr_auto] gap-2.5 border-b border-dashed border-border px-4 py-3 text-xs duration-300 fade-in"
          >
            <span
              className={cn(
                'mt-1 size-2 rounded-full',
                isRunning ? 'border-[1.5px] border-dashed border-info' : 'bg-success',
              )}
            />
            <div>
              <div className={cn('font-mono font-medium', isRunning && 'text-info')}>
                {step.name}
              </div>
              <div className="mt-0.5 text-muted-foreground">{step.detail}</div>
            </div>
            <span className="font-mono text-muted-foreground">
              {isRunning ? '…' : step.duration}
            </span>
            {/* Light runs down the rail of the step in progress, as in the panel. */}
            {isRunning && (
              <span className="absolute top-6 bottom-0 left-[19px] w-px overflow-hidden bg-border">
                <span className="absolute inset-x-0 h-2/5 animate-flow bg-info" />
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
