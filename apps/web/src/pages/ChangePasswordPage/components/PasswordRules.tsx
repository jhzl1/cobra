import { CircleCheckIcon, CircleIcon, CircleXIcon } from 'lucide-react'
import { PASSWORD_RULES } from '@cobra/contracts'
import { cn } from '~/lib/utils'

interface PasswordRulesProps {
  password: string
  /** Before the person has typed and left the field, an unmet rule is pending, not wrong. */
  isTouched: boolean
}

/**
 * Each rule ticks as it is met while the person types, so they see what is
 * missing instead of finding out when they submit.
 */
export const PasswordRules = ({ password, isTouched }: PasswordRulesProps) => (
  <ul aria-label="Requisitos de la contraseña" className="flex flex-col gap-1 text-xs">
    {PASSWORD_RULES.map((rule) => {
      const isMet = rule.pattern.test(password)
      const isMissing = !isMet && isTouched

      return (
        <li
          key={rule.label}
          className={cn(
            'flex items-center gap-1.5',
            isMet && 'text-success',
            isMissing && 'text-destructive',
            !isMet && !isMissing && 'text-muted-foreground',
          )}
        >
          {isMet && <CircleCheckIcon aria-hidden className="size-3.5" />}
          {isMissing && <CircleXIcon aria-hidden className="size-3.5" />}
          {!isMet && !isMissing && <CircleIcon aria-hidden className="size-3.5" />}
          {rule.label}
          <span className="sr-only">{isMet ? ', cumplido' : ', pendiente'}</span>
        </li>
      )
    })}
  </ul>
)
