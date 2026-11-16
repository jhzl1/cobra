import { Link } from '@tanstack/react-router'
import { SearchXIcon } from 'lucide-react'
import { ErrorFrame } from '~/components/ErrorFrame'
import { Button } from '~/components/ui/button'

/** Any route that does not exist, and a company or a platform screen this account does not reach. */
export const NotFoundPage = () => (
  <ErrorFrame icon={<SearchXIcon className="size-8" />} title="Página no encontrada">
    <p className="max-w-sm text-sm text-muted-foreground">
      Es posible que el enlace sea incorrecto o que corresponda a una empresa a la que no tienes
      acceso.
    </p>
    <Button asChild size="sm">
      <Link to="/">Volver al inicio</Link>
    </Button>
  </ErrorFrame>
)
