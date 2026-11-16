import { z } from 'zod'
import { paymentRangeSearchSchema } from '~/lib/searchSchemas'

/** The conversations tab is the default, so the URL only names the others. */
export const platformTenantTabSchema = z
  .enum(['conversations', 'pending', 'payments', 'executions', 'settings'])
  .catch('conversations')
  .default('conversations')

/**
 * The page and the days belong to the held receipts' or the payments' tab.
 * Changing tab drops them, so each tab starts over.
 */
export const platformTenantSearchSchema = paymentRangeSearchSchema.extend({
  tab: platformTenantTabSchema,
  conversationId: z.string().optional().catch(undefined),
})
