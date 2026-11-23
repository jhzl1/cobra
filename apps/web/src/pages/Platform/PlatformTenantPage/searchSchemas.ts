import { z } from 'zod'
import { heldReceiptsSearchSchema, paymentRangeSearchSchema } from '~/lib/searchSchemas'

/** The conversations tab is the default, so the URL only names the others. */
export const platformTenantTabSchema = z
  .enum(['conversations', 'pending', 'payments', 'executions', 'settings'])
  .catch('conversations')
  .default('conversations')

/**
 * The page belongs to the held receipts' or the payments' tab, the days to the
 * payments' and the status to the held receipts'. Changing tab drops them, so
 * each tab starts over.
 */
export const platformTenantSearchSchema = paymentRangeSearchSchema.extend({
  tab: platformTenantTabSchema,
  status: heldReceiptsSearchSchema.shape.status,
  conversationId: z.string().optional().catch(undefined),
})
