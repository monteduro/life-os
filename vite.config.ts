import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BACKEND_URL = 'http://10.0.0.1'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './@'),
    },
  },
  server: {
    strictPort: true,
    proxy: {
      // Tutte le chiamate API → http://smart-notes.test/api/*
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        // Riscrive il Domain dei Set-Cookie da "smart-notes.test" a "localhost"
        // così il browser accetta i cookie su localhost:5173
        cookieDomainRewrite: 'localhost',
      },
      // CSRF cookie e Sanctum → http://smart-notes.test/sanctum/*
      '/sanctum': {
        target: BACKEND_URL,
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
    },
  },
})
