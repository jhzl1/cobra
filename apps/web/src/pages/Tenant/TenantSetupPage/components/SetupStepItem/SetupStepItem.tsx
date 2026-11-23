import { Link } from '@tanstack/react-router'
import type { SetupStep } from '@cobra/contracts'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'
import { SETUP_STEP_COPY } from '../../helpers'
import { SetupStepIcon } from './components/SetupStepIcon'

interface SetupStepItemProps {
  tenantId: string
  step: SetupStep
  number: number
}

export const SetupStepItem = ({ tenantId, step, number }: SetupStepItemProps) => {
  const copy = SETUP_STEP_COPY[step.id]

  return (
    <li className="flex items-center gap-4 p-4">
      <SetupStepIcon step={step} />

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', step.isDone && 'text-muted-foreground')}>
          {number}. {copy.title}
        </p>
        <p className="text-xs text-muted-foreground">{step.missingDetail ?? copy.why}</p>
      </div>

      {!step.isDone && (
        <Button asChild size="sm" variant="secondary">
          <Link to={copy.to} params={{ tenantId }}>
            {copy.action}
          </Link>
        </Button>
      )}
    </li>
  )
}
