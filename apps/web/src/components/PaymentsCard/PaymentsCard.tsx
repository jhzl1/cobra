import { useState } from 'react'
import { defaultPaymentRange } from '@cobra/contracts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { formatPesos } from '~/utils/formatters'
import { PaymentDialog } from './components/PaymentDialog'
import { PaymentsList } from './components/PaymentsList'
import { RangeFilter } from './components/RangeFilter'
import { usePaymentsQuery } from './hooks/queries/usePaymentsQuery'

interface PaymentsCardProps {
  tenantId: string
  page: number
  /** As the URL carries them: absent means the default range. */
  from: string | undefined
  to: string | undefined
}

/**
 * The payments this app registered in Wisphub for one company, in a range of
 * registration days. Shared by the company's "Pagos" and the platform's tab,
 * which is why it lives here and not in either page. Read only in both: a
 * registered payment is corrected in Wisphub, not from here.
 *
 * The page and the days live in the URL, so a reload or a shared link shows
 * the same list.
 */
export const PaymentsCard = ({ tenantId, page, from, to }: PaymentsCardProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const fallback = defaultPaymentRange()
  const range = { from: from ?? fallback.from, to: to ?? fallback.to }

  const list = usePaymentsQuery({ tenantId, page, range })
  const selected = list.data?.items.find((payment) => payment.id === selectedId) ?? null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagos registrados</CardTitle>
        <CardDescription>
          Pagos que Wispay registró en Wisphub, ya sea por el agente o por un asesor desde
          Pendientes, filtrados por fecha de registro.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <RangeFilter range={range} />

          {list.data && (
            <div className="text-right">
              <p className="font-mono text-2xl font-semibold">
                {formatPesos(list.data.totalAmount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {list.data.total} {list.data.total === 1 ? 'pago' : 'pagos'} en el periodo
              </p>
            </div>
          )}
        </div>

        <PaymentsList
          tenantId={tenantId}
          page={page}
          range={range}
          onSelect={(payment) => setSelectedId(payment.id)}
        />
      </CardContent>

      <PaymentDialog payment={selected} onClose={() => setSelectedId(null)} />
    </Card>
  )
}
