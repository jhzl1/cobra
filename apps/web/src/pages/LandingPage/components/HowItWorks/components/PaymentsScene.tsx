import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { SceneCard } from './SceneCard'

export const PaymentsScene = () => {
  const PAYMENTS = [
    { time: '10:42', customer: 'Mariela Contreras', amount: '$ 75.000', isDuplicate: false },
    { time: '10:39', customer: 'Jhon Fredy Ospina', amount: '$ 90.000', isDuplicate: false },
    { time: '10:28', customer: 'Yesenia Rojas', amount: '$ 120.000', isDuplicate: true },
    { time: '10:21', customer: 'Carlos Ibáñez', amount: '$ 75.000', isDuplicate: false },
  ] as const

  return (
    <SceneCard title="Pagos registrados en Wisphub" meta="hoy">
      <Table className="border-collapse text-[13px]">
        <TableHeader>
          <TableRow className="text-[11px] tracking-wider uppercase hover:bg-transparent">
            <TableHead className="h-9 w-21 px-4 text-muted-foreground max-sm:hidden">
              Hora
            </TableHead>
            <TableHead className="h-9 px-4 text-muted-foreground">Cliente</TableHead>
            <TableHead className="h-9 w-28 px-4 text-muted-foreground">Monto</TableHead>
            <TableHead className="h-9 w-36 px-4 text-muted-foreground">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PAYMENTS.map((payment) => (
            <TableRow key={payment.time} className="h-12 hover:bg-transparent">
              <TableCell className="px-4 font-mono max-sm:hidden">{payment.time}</TableCell>
              <TableCell className="truncate px-4">{payment.customer}</TableCell>
              <TableCell className="px-4 font-mono">{payment.amount}</TableCell>
              <TableCell className="px-4">
                <span
                  className={
                    payment.isDuplicate
                      ? 'inline-flex items-center gap-1.5 font-medium text-destructive'
                      : 'inline-flex items-center gap-1.5 font-medium text-success'
                  }
                >
                  <span className="size-2 rounded-full bg-current" />
                  {payment.isDuplicate ? 'Duplicado' : 'Registrado'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SceneCard>
  )
}
