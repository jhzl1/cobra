import { createFileRoute } from '@tanstack/react-router'
import { defaultPaymentRange, pageSearchOf, paymentDaySearchOf } from '@cobra/contracts'
import { PaymentsPage } from '~/pages/PaymentsPage'

interface Search {
  page?: number
  /** Absent means the default: the first of the current month. */
  from?: string
  /** Absent means the default: today. */
  to?: string
}

export const Route = createFileRoute('/$tenantId/payments')({
  validateSearch: (search: Record<string, unknown>): Search => ({
    page: pageSearchOf(search['page']),
    from: paymentDaySearchOf(search['from']),
    to: paymentDaySearchOf(search['to']),
  }),
  component: () => {
    const { tenantId } = Route.useParams()
    const { page, from, to } = Route.useSearch()
    const fallback = defaultPaymentRange()

    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
        <PaymentsPage
          tenantId={tenantId}
          page={page ?? 1}
          range={{ from: from ?? fallback.from, to: to ?? fallback.to }}
        />
      </div>
    )
  },
})
