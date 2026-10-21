import { createFileRoute } from '@tanstack/react-router'
import { SetupPage } from '~/pages/SetupPage'

export const Route = createFileRoute('/$tenantId/setup')({
  component: () => {
    const { tenantId } = Route.useParams()

    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SetupPage tenantId={tenantId} />
      </div>
    )
  },
})
