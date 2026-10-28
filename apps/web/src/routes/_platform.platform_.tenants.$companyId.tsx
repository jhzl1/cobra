import { createFileRoute } from '@tanstack/react-router'
import { PlatformTenantPage, type PlatformTenantTab } from '~/pages/PlatformTenantPage'

interface Search {
  tab?: PlatformTenantTab
  conversationId?: string
}

/** The conversations tab is the default, so the URL only names the other two. */
const tabOf = (value: unknown): PlatformTenantTab | undefined => {
  if (value === 'executions' || value === 'settings') return value

  return undefined
}

/**
 * One company as the platform sees it.
 *
 * The param is `companyId` and not `tenantId` on purpose: `TenantProvider`
 * reads `tenantId` from any route, and would take this screen for the
 * company's own panel — remembering it as the last one opened and alerting on
 * its incoming messages.
 */
export const Route = createFileRoute('/_platform/platform_/tenants/$companyId')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    tab: tabOf(search['tab']),
    conversationId:
      typeof search['conversationId'] === 'string' ? search['conversationId'] : undefined,
  }),
  component: () => {
    const { companyId } = Route.useParams()
    const { tab, conversationId } = Route.useSearch()

    return (
      <PlatformTenantPage
        tenantId={companyId}
        tab={tab ?? 'conversations'}
        conversationId={conversationId ?? null}
      />
    )
  },
})
