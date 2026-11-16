import { z } from 'zod'
import { pageQuerySchema, paymentsQuerySchema } from '@cobra/contracts'

/**
 * Page 1 is the default and the URL never names it: anything missing or
 * unreadable (0, negative, text) reads as page 1.
 */
export const paginationSearchSchema = z.object({
  page: pageQuerySchema.shape.page.catch(1),
})

/**
 * A page of payments and its range of registration days. A missing or
 * malformed day reads as absent, and whoever shows the list falls back to the
 * default range, the current month so far.
 *
 * Absent and not defaulted here on purpose: the default moves with the
 * calendar, and a schema default would be written back by every link that
 * spreads the current search — turning the plain address, which means "this
 * month so far", into a fixed range the moment anyone paged through it.
 */
export const paymentRangeSearchSchema = paginationSearchSchema.extend({
  from: paymentsQuerySchema.shape.from.catch(undefined),
  to: paymentsQuerySchema.shape.to.catch(undefined),
})
