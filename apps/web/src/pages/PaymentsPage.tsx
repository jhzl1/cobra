import { type PaymentRange, PaymentsCard } from '~/components/Payments'

/**
 * "Pagos": what came in through this app, for the company's owner to see which
 * payments it registered and check each against its receipt.
 */
export const PaymentsPage = ({
  tenantId,
  page,
  range,
}: {
  tenantId: string
  page: number
  range: PaymentRange
}) => <PaymentsCard tenantId={tenantId} page={page} range={range} />
