import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  SUPABASE_URL: z.url(),
  /**
   * Singular on purpose. @supabase/server reads SUPABASE_PUBLISHABLE_KEYS first
   * and parses it as JSON; a non-JSON value there is swallowed and resolves to
   * zero keys with no error at all.
   */
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  /** The service role. It bypasses RLS entirely — see `TenantScope`. */
  SUPABASE_SECRET_KEY: z.string().min(1),
  /**
   * Required, and not derived from SUPABASE_URL: with no JWKS the adapter gives
   * up before verifying anything and every request answers 401 while holding a
   * perfectly valid token.
   */
  SUPABASE_JWKS_URL: z.url(),

  /**
   * A direct TCP connection, not the pooler.
   *
   * pg-boss lives on LISTEN/NOTIFY, which the pooler in transaction mode
   * disables. Session mode works but caps clients at the pool size, and between
   * the API and the worker that runs out quickly.
   */
  DATABASE_URL: z.string().min(1),

  /**
   * 32 bytes, base64. Every tenant credential is encrypted with it before it
   * reaches Postgres. Losing it means every client reloads their keys.
   */
  CREDENTIALS_MASTER_KEY: z.string().min(1),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
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
