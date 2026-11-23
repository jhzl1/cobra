import { Button } from '~/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { ErrorRunsList } from './components/ErrorRunsList'
import { usePlatformErrorsQuery } from './hooks/queries/usePlatformErrorsQuery'

interface ErrorsCardProps {
  page: number
}

/** Every failed attempt of every company, newest first. */
export const ErrorsCard = ({ page }: ErrorsCardProps) => {
  // The same query the list reads, here for the refresh button.
  const errors = usePlatformErrorsQuery(page)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Errores</CardTitle>
        <CardDescription>
          Ejecuciones con error en cualquier empresa. Las marcadas como “se reintentará” aún pueden
          completarse automáticamente; las marcadas como “Con error” ya agotaron sus intentos.
        </CardDescription>
        <CardAction>
          <Button
            size="sm"
            variant="secondary"
            loading={errors.isFetching}
            onClick={() => void errors.refetch()}
          >
            Actualizar
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ErrorRunsList page={page} />
      </CardContent>
    </Card>
  )
}
