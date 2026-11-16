import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { type Payment, type PaymentPage, defaultPaymentRange } from '@cobra/contracts'
import { Pager } from '~/components/Pager'
import { ReceiptPreview } from '~/components/ReceiptImage'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { Field } from '~/components/ui/field'
import { Spinner } from '~/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { usePageInUrl } from '~/hooks/usePageInUrl'
import { api } from '~/lib/api'
import { queryKeys } from '~/lib/queryClient'

export interface PaymentRange {
  from: string
  to: string
}

const KIND_LABEL: Record<Payment['kind'], string> = {
  invoice_payment: 'Pago de factura',
  credit: 'Saldo a favor',
}

const REGISTERED_BY_LABEL: Record<Payment['registeredBy'], string> = {
  agent: 'Agente',
  operator: 'Asesor (desde Pendientes)',
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
export const PaymentsCard = ({
  tenantId,
  page,
  range,
}: {
  tenantId: string
  page: number
  range: PaymentRange
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const list = useQuery({
    queryKey: queryKeys.paymentPage({ tenantId, page, ...range }),
    queryFn: async () => {
      const { data } = await api.get<PaymentPage>(`/tenants/${tenantId}/payments`, {
        params: { page, from: range.from, to: range.to },
      })

      return data
    },
    // The rows on screen stay while the next page loads, instead of a spinner.
    placeholderData: keepPreviousData,
  })

  // The placeholder is the previous page's answer; only a fresh one says where the end is.
  const total = list.data && !list.isPlaceholderData ? list.data.total : null
  const goToPage = usePageInUrl({ page, total })
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

        {list.isLoading ? (
          <div className="flex min-h-20 items-center justify-center">
            <Spinner className="size-5" />
          </div>
        ) : list.error ? (
          <p className="text-sm text-destructive">{list.error.message}</p>
        ) : list.data?.items.length ? (
          <>
            <PaymentTable
              payments={list.data.items}
              onSelect={(payment) => setSelectedId(payment.id)}
            />
            <Pager page={page} total={list.data.total} onPageChange={goToPage} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay pagos registrados en el periodo seleccionado.
          </p>
        )}
      </CardContent>

      <PaymentDialog payment={selected} onClose={() => setSelectedId(null)} />
    </Card>
  )
}

/**
 * The days in the URL. A day equal to the default range stays out of it, so
 * the plain address keeps meaning "this month so far" whenever it is opened.
 * Changing a day starts the list over on its first page.
 */
const RangeFilter = ({ range }: { range: PaymentRange }) => {
  const navigate = useNavigate()
  const fallback = defaultPaymentRange()

  const setDay = (key: keyof PaymentRange, value: string) =>
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        [key]: value && value !== fallback[key] ? value : undefined,
        page: undefined,
      }),
    })

  return (
    <div className="flex flex-wrap items-end gap-3">
      <Field
        label="Desde"
        type="date"
        className="w-44"
        value={range.from}
        max={range.to}
        onChange={(event) => setDay('from', event.target.value)}
      />
      <Field
        label="Hasta"
        type="date"
        className="w-44"
        value={range.to}
        min={range.from}
        onChange={(event) => setDay('to', event.target.value)}
      />
    </div>
  )
}

/** One row per payment, with what it takes to find one: when, who, how much. */
const PaymentTable = ({
  payments,
  onSelect,
}: {
  payments: Payment[]
  onSelect: (payment: Payment) => void
}) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Registrado</TableHead>
        <TableHead>Cliente</TableHead>
        <TableHead>Documento</TableHead>
        <TableHead>Tipo</TableHead>
        <TableHead className="text-right">Monto</TableHead>
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
            <p className="font-medium">{payment.contact.displayName ?? 'Sin nombre'}</p>
            <p className="font-mono text-xs text-muted-foreground">
              {payment.contact.phone ?? 'Número oculto'}
            </p>
          </TableCell>
          <TableCell className="font-mono text-xs">{payment.documents.join(', ')}</TableCell>
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

/**
 * One payment: what was registered in Wisphub, and the receipt it came from
 * beside it, so the two can be checked against each other.
 */
const PaymentDialog = ({ payment, onClose }: { payment: Payment | null; onClose: () => void }) => (
  <Dialog
    open={!!payment}
    onOpenChange={(open) => {
      if (!open) onClose()
    }}
  >
    <DialogContent className="sm:max-w-4xl">
      {payment && (
        <>
          <DialogHeader>
            <DialogTitle>
              {formatPesos(payment.amount)} · {KIND_LABEL[payment.kind]}
            </DialogTitle>
            <DialogDescription>
              {payment.contact.displayName ?? 'Sin nombre'} ·{' '}
              {payment.contact.phone ?? 'Número oculto'}
            </DialogDescription>
          </DialogHeader>

          {/* Keyed by payment: the image's loading state starts over for each. */}
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <ReceiptPreview key={payment.id} url={payment.receipt?.imageUrl ?? null} />

            <div className="flex min-w-0 flex-col gap-4">
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  En Wisphub
                </h3>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                  <Detail label="Registrado el" value={formatDateTime(payment.registeredAt)} />
                  <Detail
                    label="Registrado por"
                    value={REGISTERED_BY_LABEL[payment.registeredBy]}
                  />
                  <Detail label="Documento" value={payment.documents.join(', ') || null} />
                  <Detail
                    label="Facturas pagadas"
                    value={payment.invoiceIds.length ? payment.invoiceIds.join(', ') : null}
                  />
                </dl>
              </section>

              {payment.receipt && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Datos leídos del comprobante
                  </h3>
                  <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                    <Detail
                      label="Monto"
                      value={
                        payment.receipt.amount === null ? null : formatPesos(payment.receipt.amount)
                      }
                    />
                    <Detail
                      label="Fecha del pago"
                      value={payment.receipt.paidAt ? formatDateTime(payment.receipt.paidAt) : null}
                    />
                    <Detail
                      label="Referencia"
                      value={payment.receipt.references.join(', ') || null}
                    />
                    <Detail label="Medio de pago" value={payment.receipt.destinationMethod} />
                    <Detail label="Cuenta de destino" value={payment.receipt.destinationAccount} />
                    <Detail
                      label="Confianza de la lectura"
                      value={
                        payment.receipt.confidence === null
                          ? null
                          : `${Math.round(payment.receipt.confidence * 100)} %`
                      }
                    />
                    <Detail label="Descripción" value={payment.receipt.description} />
                  </dl>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </DialogContent>
  </Dialog>
)

const Detail = ({ label, value }: { label: string; value: string | null }) => (
  <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 break-words">{value ?? 'No disponible'}</dd>
  </>
)

const formatPesos = (amount: number): string =>
  amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('es-CO', { hour12: true })
