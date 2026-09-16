import { Link } from '@tanstack/react-router'
import { AlertTriangleIcon, SearchXIcon } from 'lucide-react'
import { Button } from '~/components/ui/button'

const Frame = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) => (
  <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
    <div className="text-muted-foreground">{icon}</div>
    <h1 className="text-xl font-semibold">{title}</h1>
    {children}
  </div>
)

/** Any route that does not exist. */
export const NotFoundPage = () => (
  <Frame icon={<SearchXIcon className="size-8" />} title="Esta página no existe">
    <p className="max-w-sm text-sm text-muted-foreground">
      Puede que el enlace esté mal escrito, o que la conversación que buscas sea de otra empresa.
    </p>
    <Button asChild size="sm">
      <Link to="/chats">Ir a las conversaciones</Link>
    </Button>
  </Frame>
)

/**
 * Whatever a route threw.
 *
 * The message is shown rather than swallowed: the API answers in Spanish and
 * says what the operator can do about it, and hiding that behind "algo salió
 * mal" turns a fixable problem into a support ticket. `reset` re-runs the route
 * without a full reload, which is what recovers from a request that failed once.
 */
export const ErrorPage = ({ error, reset }: { error: unknown; reset: () => void }) => {
  // The router types what a route threw as unknown, because a throw can be
  // anything. Only a real message is worth putting on screen.
  const message = error instanceof Error ? error.message : null

  return (
    <Frame icon={<AlertTriangleIcon className="size-8" />} title="Algo falló al cargar esta página">
      {message && <p className="max-w-lg font-mono text-xs text-destructive">{message}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={reset}>
          Reintentar
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link to="/chats">Ir a las conversaciones</Link>
        </Button>
      </div>
    </Frame>
  )
}
