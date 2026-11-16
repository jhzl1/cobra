import { type ErrorComponentProps, Link } from '@tanstack/react-router'
import { AlertTriangleIcon } from 'lucide-react'
import { ErrorFrame } from '~/components/ErrorFrame'
import { Button } from '~/components/ui/button'

type ErrorPageProps = Pick<ErrorComponentProps, 'error' | 'reset'>

/**
 * Whatever a route threw.
 *
 * The message is shown rather than swallowed: the API answers in Spanish and
 * says what the operator can do about it, and hiding that behind "algo salió
 * mal" turns a fixable problem into a support ticket. `reset` re-runs the route
 * without a full reload, which is what recovers from a request that failed once.
 */
export const ErrorPage = ({ error, reset }: ErrorPageProps) => {
  // A throw can be anything. Only a real message is worth putting on screen.
  const message = error instanceof Error ? error.message : null

  return (
    <ErrorFrame
      icon={<AlertTriangleIcon className="size-8" />}
      title="No fue posible cargar esta página"
    >
      {message && <p className="max-w-lg font-mono text-xs text-destructive">{message}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={reset}>
          Reintentar
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link to="/">Volver al inicio</Link>
        </Button>
      </div>
    </ErrorFrame>
  )
}
