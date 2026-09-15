import { defineConfig } from 'tsup'

/**
 * ESM only. `ai` v7 has no `require` export, so a CommonJS build of this package
 * would compile and then fail at the first import at runtime — the worst shape
 * of failure. @cobra/worker is ESM precisely so this stays honest.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['zod', 'ai', '@openrouter/ai-sdk-provider', '@cobra/contracts'],
})
