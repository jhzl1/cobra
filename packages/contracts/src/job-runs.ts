import { z } from 'zod'
import { jobRunStatusSchema } from './domain'
// Side effect: zod answers in Spanish. Imported per module, not only from
// index, so importing this file directly cannot skip it.
import './locale'

/**
 * One attempt of one worker job, as the platform reads it.
 *
 * A failed attempt with `attempt < maxAttempts` is one pg-boss is going to
 * retry; at `attempt === maxAttempts` the job gave up.
 */
export const jobRunSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  conversationId: z.uuid().nullable(),
  /** One of `QUEUES`. */
  queue: z.string(),
  jobId: z.uuid(),
  attempt: z.number().int(),
  maxAttempts: z.number().int(),
  status: jobRunStatusSchema,
  error: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
})

export type JobRun = z.infer<typeof jobRunSchema>

/** The error tray reads across every company, so each row says whose it is. */
export const platformErrorSchema = jobRunSchema.extend({
  companyName: z.string(),
})

export type PlatformError = z.infer<typeof platformErrorSchema>
