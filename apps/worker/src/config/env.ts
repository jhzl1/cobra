import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),

  /**
   * A direct TCP connection, not the pooler: pg-boss lives on LISTEN/NOTIFY,
   * which the pooler in transaction mode disables.
   *
   * On Railway the first deploy fails here with ENETUNREACH — Supabase's direct
   * connection is IPv6 only and Railway does not enable outbound IPv6 by
   * default. Settings → Networking → Outbound IPv6, then redeploy.
   */
  DATABASE_URL: z.string().min(1),

  CREDENTIALS_MASTER_KEY: z.string().min(1),

  /** How many turns this worker runs at once, across all tenants. */
  TURN_CONCURRENCY: z.coerce.number().int().positive().default(4),
})

export type Env = z.infer<typeof envSchema>

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n  ')
    throw new Error(`Invalid environment configuration:\n  ${details}`)
  }

  return result.data
}
