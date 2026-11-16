import { createFileRoute } from '@tanstack/react-router'
import { pageSearchOf } from '@cobra/contracts'
import { PendingPage } from '~/pages/PendingPage'

interface Search {
  page?: number
}

export const Route = createFileRoute('/$tenantId/pending')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    page: pageSearchOf(search['page']),
  }),
  component: () => {
    const { tenantId } = Route.useParams()
    const { page } = Route.useSearch()

    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <PendingPage tenantId={tenantId} page={page ?? 1} />
      </div>
    )
  },
})
