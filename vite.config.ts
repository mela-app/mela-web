/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Settings come only from .env (see .env.example) - there are no built-in addresses.
const DEV_SETTINGS = ['WEB_API_ORIGIN', 'VITE_APP_URL_SCHEME', 'VITE_ANDROID_APP_PACKAGE_NAME'] as const

// Served under /web/ beside the API's share page (/live/:id), which loads the
// entry by these fixed names: player.js and player.css are revalidated on
// every visit; everything under assets/ is content-hashed and cached for good.
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Only the dev server and preview need them; builds and tests don't.
  if (command === 'serve' && mode !== 'test') {
    const missing = DEV_SETTINGS.filter((key) => !env[key])
    if (missing.length > 0) {
      throw new Error(`Set ${missing.join(', ')} in .env (copy .env.example).`)
    }
  }
  const proxy = env.WEB_API_ORIGIN
    ? {
        '/v1': { target: env.WEB_API_ORIGIN },
        '/socket.io': { target: env.WEB_API_ORIGIN, ws: true },
      }
    : undefined

  return {
    base: '/web/',
    plugins: [react()],
    build: {
      cssCodeSplit: false,
      // The video SDKs (Agora's is ~1.5 MB) are their own chunks, loaded only for the provider in use.
      chunkSizeWarningLimit: 1600,
      rolldownOptions: {
        input: 'src/main.tsx',
        output: {
          entryFileNames: 'player.js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: (asset) =>
            asset.names.some((name) => name.endsWith('.css')) ? 'player.css' : 'assets/[name]-[hash][extname]',
        },
      },
    },
    // Development: open /web/?stream=<live id> - the API and its sockets are proxied, one origin as in production.
    server: {
      port: 5174,
      strictPort: true,
      proxy,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
      unstubEnvs: true,
    },
  }
})
