import type { Payment } from '@cobra/contracts'
import { Pager } from '~/components/Pager'
import { Spinner } from '~/components/ui/spinner'
import { usePageInUrl } from '~/hooks/usePageInUrl'
import { usePaymentsQuery } from '../hooks/queries/usePaymentsQuery'
import type { PaymentRange } from '../types'
import { PaymentTable } from './PaymentTable'

interface PaymentsListProps {
  tenantId: string
  page: number
  range: PaymentRange
  onSelect: (payment: Payment) => void
}

export const PaymentsList = ({ tenantId, page, range, onSelect }: PaymentsListProps) => {
  const list = usePaymentsQuery({ tenantId, page, range })
  // The placeholder is the previous page's answer; only a fresh one says where the end is.
  const total = list.data && !list.isPlaceholderData ? list.data.total : null
  const goToPage = usePageInUrl({ page, total })

  if (list.isLoading) {
    return (
      <div className="flex min-h-20 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    )
  }

  if (list.error) {
    return <p className="text-sm text-destructive">{list.error.message}</p>
  }

  if (!list.data?.items.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay pagos registrados en el periodo seleccionado.
      </p>
    )
  }

  return (
    <>
      <PaymentTable payments={list.data.items} onSelect={onSelect} />
      <Pager page={page} total={list.data.total} onPageChange={goToPage} />
    </>
  )
}
