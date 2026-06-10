import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = process.env.NODE_ENV === 'development'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: isDev ? {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://jobsglobalscraper.ddns.net',
        changeOrigin: true,
        secure: false,
      }
    }
  } : undefined,
})