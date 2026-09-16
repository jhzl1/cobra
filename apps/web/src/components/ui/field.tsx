import * as React from 'react'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { cn } from '~/lib/utils'

interface Props extends React.ComponentProps<typeof Input> {
  label: string
  /** Shown under the field, in red, with `aria-invalid` on the input. */
  error?: string
}

/**
 * An input with its label tied to it.
 *
 * HeroUI took the label as a prop; shadcn keeps Label and Input apart on
 * purpose, which means a stable id in each of the fifteen places the panel has
 * a field. `className` goes on the wrapper rather than the input, so the widths
 * the pages already use (`w-64`, `w-80`) keep measuring the whole field.
 */
export const Field = ({ label, error, className, id: idProp, required, ...props }: Props) => {
  const generated = React.useId()
  const id = idProp ?? generated
  const errorId = `${id}-error`

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {/* gap-0: shadcn's Label spaces its children, which would push the
          asterisk away from the word it belongs to. */}
      <Label htmlFor={id} className="gap-0">
        {label}
        {required ? (
          <span className="text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>

      <Input
        id={id}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        className="w-full"
        {...props}
      />

      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
