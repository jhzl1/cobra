import { createFileRoute } from '@tanstack/react-router'
import { defaultPaymentRange, pageSearchOf, paymentDaySearchOf } from '@cobra/contracts'
import { PlatformTenantPage, type PlatformTenantTab } from '~/pages/PlatformTenantPage'

interface Search {
  tab?: PlatformTenantTab
  conversationId?: string
  /**
   * The held receipts' or the payments' page and the payments' days. Changing
   * tab drops them, so each tab starts over.
   */
  page?: number
  from?: string
  to?: string
}

/** The conversations tab is the default, so the URL only names the others. */
const tabOf = (value: unknown): PlatformTenantTab | undefined => {
  if (value === 'pending' || value === 'payments' || value === 'executions' || value === 'settings')
    return value

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
    page: pageSearchOf(search['page']),
    from: paymentDaySearchOf(search['from']),
    to: paymentDaySearchOf(search['to']),
  }),
  component: () => {
    const { companyId } = Route.useParams()
    const { tab, conversationId, page, from, to } = Route.useSearch()
    const fallback = defaultPaymentRange()

    return (
      <PlatformTenantPage
        tenantId={companyId}
        tab={tab ?? 'conversations'}
        conversationId={conversationId ?? null}
        page={page ?? 1}
        range={{ from: from ?? fallback.from, to: to ?? fallback.to }}
      />
    )
  },
})
