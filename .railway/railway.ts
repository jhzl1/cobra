import { defineRailway, empty, preserve, project, service } from 'railway/iac'

/**
 * The Railway project, applied with `railway config plan` and `railway config
 * apply` against the linked environment. Railway does not read this file on
 * deploy: a setting changed here reaches Railway only when someone applies it.
 *
 * It replaces the per-service railway.json files, which Railway deprecated and
 * stopped accepting for services created after 2026-08-28.
 */
export default defineRailway(() => {
  /**
   * No repository: .github/workflows/deploy.yml uploads each build with
   * `railway up` after the migrations it needs. A GitHub source would deploy the
   * same push a second time on its own, before the migration and with whatever
   * variables Railway held, and under no version.
   */
  const source = empty()

  /**
   * Builds through turbo and not `pnpm --filter`: packages/* are imported from
   * their dist, and only turbo compiles them first (`dependsOn: ["^build"]`).
   */
  const buildFor = (app: 'api' | 'worker') => ({
    builder: 'RAILPACK' as const,
    buildCommand: `pnpm turbo run build --filter=@cobra/${app}`,
    /**
     * None, on purpose, and written as `[]`: Railway keeps the old patterns when
     * the field is left out. With patterns, `railway up` compares the upload
     * with the last deploy and ends SKIPPED ("No changes to watched files")
     * when nothing they cover changed — a push that only touched the workflow,
     * or a re-run — and `railway up --ci` waits on that forever. Even `**`
     * skips a re-run. Deploys come only from the workflow now, so there is
     * nothing for the patterns to filter.
     */
    watchPatterns: [],
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
   * Every value comes from the GitHub Environment: deploy.yml writes it before
   * each `railway up` (.github/scripts/sync-railway-variables.sh holds the
   * lists). `preserve()` declares the names so `apply` neither deletes them nor
   * writes a value of its own over the one GitHub set.
   */
  const fromGitHub = (names: string[]) => {
    const variables: Record<string, ReturnType<typeof preserve>> = {}
    for (const name of names) variables[name] = preserve()
    return variables
  }

  /**
   * Both services read these from the same GitHub secret, which is what keeps
   * CREDENTIALS_MASTER_KEY identical: if it differed, every stored credential
   * would be unreadable to one of the two.
   */
  const commonNames = [
    'NODE_ENV',
    'APP_VERSION',
    'SUPABASE_URL',
    'SUPABASE_SECRET_KEY',
    'DATABASE_URL',
    'CREDENTIALS_MASTER_KEY',
  ]

  const apiEnv = fromGitHub([
    ...commonNames,
    'PUBLIC_URL',
    'CORS_ORIGINS',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_JWKS_URL',
  ])

  const api = service('api', {
    source,
    build: buildFor('api'),
    deploy: { ...deployFor('api'), healthcheckPath: '/api/health' },
    env: apiEnv,
  })

  const workerEnv = fromGitHub([...commonNames, 'TURN_CONCURRENCY'])

  // No healthcheck: the worker is a standalone context with no HTTP port.
  const worker = service('worker', {
    source,
    build: buildFor('worker'),
    deploy: deployFor('worker'),
    env: workerEnv,
  })

  return project('cobra', { resources: [api, worker] })
})
