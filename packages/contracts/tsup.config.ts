import { defineConfig } from 'tsup'

/**
 * Dual build on purpose: apps/api and apps/worker compile to CommonJS for Nest
 * and `require()` this package, while Vite serves it to the browser as ESM. A
 * single-format build breaks one of the two.
 *
 * `clean` is off in watch mode, and that is not a preference. In watch, tsup
 * empties dist/ as it starts — taking with it the .d.ts files turbo's `^build`
 * has just produced. apps/api begins compiling inside that gap and fails with
 * TS7016, "Could not find a declaration file for module '@cobra/contracts'",
 * which reads as a missing dependency and is a race.
 */
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: !options.watch,
  // zod stays external so every consumer shares one copy of it.
  external: ['zod'],
}))
