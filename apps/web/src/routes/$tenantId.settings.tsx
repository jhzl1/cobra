import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '~/pages/SettingsPage'

export const Route = createFileRoute('/$tenantId/settings')({
  component: () => {
    const { tenantId } = Route.useParams()

    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SettingsPage tenantId={tenantId} />
      </div>
    )
  },
})
