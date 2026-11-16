import type { Payment } from '@cobra/contracts'
import { Badge } from '~/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { formatDateTime, formatPesos } from '~/utils/formatters'
import { KIND_LABEL } from '../helpers'

interface PaymentTableProps {
  payments: Payment[]
  onSelect: (payment: Payment) => void
}

/** One row per payment, with what it takes to find one: when, who, how much. */
export const PaymentTable = ({ payments, onSelect }: PaymentTableProps) => (
  <Table className="min-w-[760px]">
    <TableHeader>
      <TableRow>
        <TableHead className="w-52">Registrado</TableHead>
        <TableHead>Cliente</TableHead>
        <TableHead className="w-40">Documento</TableHead>
        <TableHead className="w-36">Tipo</TableHead>
        <TableHead className="w-36 text-right">Monto</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {payments.map((payment) => (
        <TableRow
          key={payment.id}
          tabIndex={0}
          onClick={() => onSelect(payment)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(payment)
            }
          }}
          className="cursor-pointer outline-none focus-visible:bg-muted/50"
        >
          <TableCell className="font-mono text-xs whitespace-nowrap">
            {formatDateTime(payment.registeredAt)}
          </TableCell>
          <TableCell>
            <p className="truncate font-medium">{payment.contact.displayName ?? 'Sin nombre'}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {payment.contact.phone ?? 'Número oculto'}
            </p>
          </TableCell>
          <TableCell className="truncate font-mono text-xs">
            {payment.documents.join(', ')}
          </TableCell>
          <TableCell>
            <Badge variant={payment.kind === 'credit' ? 'info' : 'success'}>
              {KIND_LABEL[payment.kind]}
            </Badge>
          </TableCell>
          <TableCell className="text-right font-mono">{formatPesos(payment.amount)}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
)
