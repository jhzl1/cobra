import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { version } from './package.json' with { type: 'json' }

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // The router plugin goes first: it writes src/routeTree.gen.ts from
    // src/routes, and React's transform has to see the file it wrote.
    plugins: [tanstackRouter({ target: 'react' }), react(), tailwindcss()],
    resolve: {
      alias: { '~': '/src' },
    },
    server: { port: 4100 },
    define: {
      // `||` and not `??`: a .env copied from the example carries an empty
      // VITE_APP_VERSION, and that has to fall back too.
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || version),
    },
  }
})
