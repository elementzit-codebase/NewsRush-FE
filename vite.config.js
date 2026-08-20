import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The backend only allows a fixed CORS origin list (localhost:3000 and :5173),
// and Vite moves to another port whenever 5173 is taken. Proxying instead of
// calling the API cross-origin keeps requests same-origin, so the dev server
// works on whatever port it lands on without touching the backend's config.
const API_TARGET = 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      // Profile pictures are served as static files off the same backend.
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
})
