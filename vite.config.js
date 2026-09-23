import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The third argument is an empty prefix, so unprefixed variables are read
  // too. API_PROXY_TARGET deliberately has no VITE_ prefix: it is used here at
  // config time and must never be inlined into the client bundle.
  const env = loadEnv(mode, process.cwd(), '')

  // The backend only allows a fixed CORS origin list, and Vite moves to another
  // port whenever 5173 is taken. Proxying instead of calling the API
  // cross-origin keeps requests same-origin, so the dev server works on
  // whatever port it lands on without touching the backend's config.
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:8001'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': { target, changeOrigin: true },
        // Profile pictures are served as static files off the same backend.
        '/uploads': { target, changeOrigin: true },
      },
    },
  }
})
