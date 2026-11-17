import { useState } from 'react'
import type { HeldReceiptStatus } from '@cobra/contracts'
import { HeldReceiptDialog } from '~/components/HeldReceiptDialog'
import { HeldReceiptsTabs } from '~/components/HeldReceiptsTabs'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { useHeldReceiptsQuery } from '~/hooks/queries/useHeldReceiptsQuery'

interface ReadOnlyHeldReceiptsProps {
  tenantId: string
  status: HeldReceiptStatus
  page: number
}

/**
 * The company's held receipts and their history, to read. Applying and
 * dismissing stay with the company's own team, like answering its customers
 * does.
 */
export const ReadOnlyHeldReceipts = ({ tenantId, status, page }: ReadOnlyHeldReceiptsProps) => {
  const heldReceipts = useHeldReceiptsQuery({ tenantId, status, page })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = heldReceipts.data?.items.find((receipt) => receipt.id === selectedId) ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comprobantes pendientes</CardTitle>
      </CardHeader>
      <CardContent>
        <HeldReceiptsTabs
          tenantId={tenantId}
          status={status}
          page={page}
          onSelect={(receipt) => setSelectedId(receipt.id)}
        />
      </CardContent>

      <HeldReceiptDialog receipt={selected} onClose={() => setSelectedId(null)} />
    </Card>
  )
}
