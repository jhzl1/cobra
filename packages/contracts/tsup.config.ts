import { defineConfig } from 'tsup'

/**
 * Dual build on purpose: apps/api and apps/worker compile to CommonJS for Nest
 * and `require()` this package, while Vite serves it to the browser as ESM. A
 * single-format build breaks one of the two.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  // zod stays external so every consumer shares one copy of it.
  external: ['zod'],
})
