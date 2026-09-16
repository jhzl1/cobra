import { defineConfig } from 'tsup'

/**
 * Dual build: @cobra/api is CommonJS NestJS and @cobra/worker is ESM, and both
 * reach the database through this package.
 *
 * `clean` is off in watch mode so the declaration files survive the start of
 * `pnpm dev` — see the same comment in @cobra/contracts.
 */
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: !options.watch,
  external: ['@supabase/supabase-js', '@cobra/contracts'],
}))
