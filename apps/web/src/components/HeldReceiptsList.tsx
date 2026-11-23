import type { ReactNode } from 'react'
import type { HeldReceipt, HeldReceiptStatus } from '@cobra/contracts'
import { PageLoadingBar } from '~/components/PageLoadingBar'
import { Pager } from '~/components/Pager'
import { Spinner } from '~/components/ui/spinner'
import { useHeldReceiptsQuery } from '~/hooks/queries/useHeldReceiptsQuery'
import { usePageInUrl } from '~/hooks/usePageInUrl'

interface HeldReceiptsListProps {
  tenantId: string
  status: HeldReceiptStatus
  page: number
  emptyText: string
  /** The open and the resolved receipts are told apart by different columns. */
  renderTable: (receipts: HeldReceipt[]) => ReactNode
}

/** One page of a company's held receipts, open or resolved, for the company and the platform. */
export const HeldReceiptsList = ({
  tenantId,
  status,
  page,
  emptyText,
  renderTable,
}: HeldReceiptsListProps) => {
  const heldReceipts = useHeldReceiptsQuery({ tenantId, status, page })
  // The placeholder is the previous page's answer; only a fresh one says where the end is.
  const total =
    heldReceipts.data && !heldReceipts.isPlaceholderData ? heldReceipts.data.total : null
  const goToPage = usePageInUrl({ page, total })

  if (heldReceipts.isLoading) {
    return (
      <div className="flex min-h-20 items-center justify-center">
        <Spinner className="size-5" />
      </div>
    )
  }

  if (heldReceipts.error) {
    return <p className="text-sm text-destructive">{heldReceipts.error.message}</p>
  }

  if (!heldReceipts.data?.items.length) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div>
      <PageLoadingBar isLoading={heldReceipts.isPlaceholderData} />
      {renderTable(heldReceipts.data.items)}
      <Pager page={page} total={heldReceipts.data.total} onPageChange={goToPage} />
    </div>
  )
}
