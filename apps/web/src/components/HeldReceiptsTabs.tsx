import { useNavigate } from '@tanstack/react-router'
import { type HeldReceipt, type HeldReceiptStatus, heldReceiptStatusSchema } from '@cobra/contracts'
import { HeldReceiptTable } from '~/components/HeldReceiptTable'
import { HeldReceiptsList } from '~/components/HeldReceiptsList'
import { ResolvedReceiptTable } from '~/components/ResolvedReceiptTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useOpenHeldReceiptCountQuery } from '~/hooks/queries/useOpenHeldReceiptCountQuery'

interface HeldReceiptsTabsProps {
  tenantId: string
  status: HeldReceiptStatus
  page: number
  onSelect: (receipt: HeldReceipt) => void
}

/**
 * "Por resolver" and "Historial" of a company's held receipts. The tab lives in
 * the URL's `?status=`, so a reload or a shared link opens the same one, and
 * changing it starts the list over from page 1.
 */
export const HeldReceiptsTabs = ({ tenantId, status, page, onSelect }: HeldReceiptsTabsProps) => {
  const navigate = useNavigate()
  const openCount = useOpenHeldReceiptCountQuery(tenantId)

  const handleStatusChange = (value: string) => {
    const nextStatus = heldReceiptStatusSchema.parse(value)

    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        status: nextStatus,
        page: undefined,
      }),
    })
  }

  return (
    <Tabs value={status} onValueChange={handleStatusChange} className="gap-4">
      <TabsList>
        <TabsTrigger value="open">
          Por resolver
          {!!openCount.data && (
            <span className="font-mono text-xs font-semibold">{openCount.data}</span>
          )}
        </TabsTrigger>
        <TabsTrigger value="resolved">Historial</TabsTrigger>
      </TabsList>

      <TabsContent value="open">
        <HeldReceiptsList
          tenantId={tenantId}
          status="open"
          page={page}
          emptyText="No hay comprobantes por resolver."
          renderTable={(receipts) => <HeldReceiptTable receipts={receipts} onSelect={onSelect} />}
        />
      </TabsContent>

      <TabsContent value="resolved">
        <HeldReceiptsList
          tenantId={tenantId}
          status="resolved"
          page={page}
          emptyText="Todavía no se ha aplicado ni descartado ningún comprobante."
          renderTable={(receipts) => (
            <ResolvedReceiptTable receipts={receipts} onSelect={onSelect} />
          )}
        />
      </TabsContent>
    </Tabs>
  )
}
