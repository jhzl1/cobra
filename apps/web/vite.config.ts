import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { version } from './package.json' with { type: 'json' }

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '~': '/src' },
    },
    server: { port: 4100 },
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION ?? version),
    },
  }
})
