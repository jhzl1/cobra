import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { ExecutionsList } from './components/ExecutionsList'

interface ExecutionsProps {
  tenantId: string
}

/** What the worker ran for the company, newest first. */
export const Executions = ({ tenantId }: ExecutionsProps) => {
  const [isOnlyErrors, setIsOnlyErrors] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ejecuciones</CardTitle>
        <CardAction>
          <Button
            size="sm"
            variant="secondary"
            aria-pressed={isOnlyErrors}
            onClick={() => setIsOnlyErrors((current) => !current)}
          >
            {isOnlyErrors ? 'Ver todas' : 'Ver solo errores'}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ExecutionsList tenantId={tenantId} isOnlyErrors={isOnlyErrors} />
      </CardContent>
    </Card>
  )
}
