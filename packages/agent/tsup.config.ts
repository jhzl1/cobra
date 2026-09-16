import { defineConfig } from 'tsup'

/**
 * ESM only. `ai` v7 has no `require` export, so a CommonJS build of this package
 * would compile and then fail at the first import at runtime — the worst shape
 * of failure. @cobra/worker is ESM precisely so this stays honest.
 *
 * `clean` is off in watch mode so the declaration files survive the start of
 * `pnpm dev` — see the same comment in @cobra/contracts.
 */
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: !options.watch,
  external: ['zod', 'ai', '@openrouter/ai-sdk-provider', '@cobra/contracts'],
}))
