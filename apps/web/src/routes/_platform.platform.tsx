import { createFileRoute } from '@tanstack/react-router'
import { pageSearchOf } from '@cobra/contracts'
import { PlatformPage, type PlatformTab, tabSearchOf } from '~/pages/PlatformPage'

interface Search {
  tab?: PlatformTab
  page?: number
}

export const Route = createFileRoute('/_platform/platform')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    tab: tabSearchOf(search['tab']),
    page: pageSearchOf(search['page']),
  }),
  component: () => {
    const { tab, page } = Route.useSearch()

    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PlatformPage tab={tab ?? 'companies'} page={page ?? 1} />
      </div>
    )
  },
})
