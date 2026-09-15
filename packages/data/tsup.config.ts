import { defineConfig } from 'tsup'

/**
 * Dual build: @cobra/api is CommonJS NestJS and @cobra/worker is ESM, and both
 * reach the database through this package.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@supabase/supabase-js', '@cobra/contracts'],
})
