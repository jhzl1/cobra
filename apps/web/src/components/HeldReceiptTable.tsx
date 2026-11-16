import { ALERT_REASON_TEXT, type HeldReceipt } from '@cobra/contracts'
import { Badge } from '~/components/ui/badge'
import { Spinner } from '~/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { formatDateTime, formatPesos } from '~/utils/formatters'

interface HeldReceiptTableProps {
  receipts: HeldReceipt[]
  onSelect: (receipt: HeldReceipt) => void
}

/**
 * One row per held receipt, with only what it takes to pick one: who, why, how
 * much and when. Everything else is in the dialog the row opens.
 */
export const HeldReceiptTable = ({ receipts, onSelect }: HeldReceiptTableProps) => (
  <Table className="min-w-[880px]">
    <TableHeader>
      <TableRow>
        <TableHead>Cliente</TableHead>
        <TableHead className="w-[27rem]">Motivo</TableHead>
        <TableHead className="w-32 text-right">Monto</TableHead>
        <TableHead className="w-52">Recibido</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {receipts.map((receipt) => (
        <TableRow
          key={receipt.id}
          tabIndex={0}
          onClick={() => onSelect(receipt)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(receipt)
            }
          }}
          className="cursor-pointer outline-none focus-visible:bg-muted/50"
        >
          <TableCell>
            <p className="truncate font-medium">{receipt.contact.displayName ?? 'Sin nombre'}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {receipt.contact.phone ?? 'Número oculto'}
            </p>
          </TableCell>
          <TableCell>
            <div className="flex items-center gap-2">
              <Badge variant="warning">{ALERT_REASON_TEXT[receipt.alertReason]}</Badge>
              {receipt.resolution === 'applying' && (
                <Spinner className="size-3" aria-label="Registrando en Wisphub" />
              )}
            </div>
          </TableCell>
          <TableCell className="text-right font-mono">
            {receipt.amount === null ? '—' : formatPesos(receipt.amount)}
          </TableCell>
          <TableCell className="font-mono text-xs whitespace-nowrap">
            {formatDateTime(receipt.receivedAt)}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
)
