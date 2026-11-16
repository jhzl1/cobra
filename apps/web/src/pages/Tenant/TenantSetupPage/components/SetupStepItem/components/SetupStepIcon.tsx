import { CheckCircle2Icon, CircleDashedIcon, CircleSlashIcon } from 'lucide-react'
import type { SetupStep } from '@cobra/contracts'

interface SetupStepIconProps {
  step: SetupStep
}

export const SetupStepIcon = ({ step }: SetupStepIconProps) => {
  if (step.isDone) {
    return <CheckCircle2Icon className="size-5 shrink-0 text-success" aria-hidden />
  }

  if (step.id === 'webhook') {
    return <CircleSlashIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
  }

  return <CircleDashedIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
}
