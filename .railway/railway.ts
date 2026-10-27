import { defineRailway, github, preserve, project, service } from 'railway/iac'

/**
 * The Railway project, applied with `railway config plan` and `railway config
 * apply` against the linked environment. Railway does not read this file on
 * deploy: a setting changed here reaches Railway only when someone applies it.
 *
 * It replaces the per-service railway.json files, which Railway deprecated and
 * stopped accepting for services created after 2026-08-28.
 */
export default defineRailway((ctx) => {
  const isProduction = ctx.environment === 'production'

  /**
   * `checkSuites` is Wait for CI: the deploy waits for migrate-dev.yml, so new
   * code never boots against the schema it expects before the migration lands.
   */
  const source = github('jhzl1/cobra', {
    branch: isProduction ? 'main' : 'develop',
    checkSuites: true,
  })

  /**
   * Builds through turbo and not `pnpm --filter`: packages/* are imported from
   * their dist, and only turbo compiles them first (`dependsOn: ["^build"]`).
   */
  const buildFor = (app: 'api' | 'worker') => ({
    builder: 'RAILPACK' as const,
    buildCommand: `pnpm turbo run build --filter=@cobra/${app}`,
    watchPatterns: [
      `/apps/${app}/**`,
      '/packages/**',
      '/package.json',
      '/pnpm-lock.yaml',
      '/turbo.json',
    ],
  })

  /**
   * Supabase's direct connection is IPv6-only and Railway ships with outbound
   * IPv6 off, so without this the first query fails with ENETUNREACH. The
   * pooler is not a way around it: transaction mode disables LISTEN/NOTIFY,
   * which pg-boss lives on.
   */
  const deployFor = (app: 'api' | 'worker') => ({
    startCommand: `node apps/${app}/dist/main.js`,
    ipv6EgressEnabled: true,
  })

  /**
   * Shared variables, defined once per environment in Railway, because api and
   * worker must read the same values: a CREDENTIALS_MASTER_KEY that differs
   * between them makes every stored credential unreadable to one of the two.
   */
  const sharedEnv = {
    NODE_ENV: 'production',
    SUPABASE_URL: ctx.shared.SUPABASE_URL,
    SUPABASE_SECRET_KEY: ctx.shared.SUPABASE_SECRET_KEY,
    DATABASE_URL: ctx.shared.DATABASE_URL,
    CREDENTIALS_MASTER_KEY: ctx.shared.CREDENTIALS_MASTER_KEY,
  }

  const api = service('api', {
    source,
    build: buildFor('api'),
    deploy: { ...deployFor('api'), healthcheckPath: '/api/health' },
    env: {
      ...sharedEnv,
      // Set in Railway: they depend on the domains each environment was given.
      PUBLIC_URL: preserve(),
      CORS_ORIGINS: preserve(),
      SUPABASE_PUBLISHABLE_KEY: preserve(),
      SUPABASE_JWKS_URL: preserve(),
    },
  })

  // No healthcheck: the worker is a standalone context with no HTTP port.
  const worker = service('worker', {
    source,
    build: buildFor('worker'),
    deploy: deployFor('worker'),
    env: sharedEnv,
  })

  return project('cobra', { resources: [api, worker] })
})
