import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Valores por entorno (cada máquina puede sobrescribirlos):
//   VITE_PORT  — puerto del dev server (default 5173)
//   VITE_API_TARGET — backend al que proxyea /api (default 8002)
const PORT = Number(process.env.VITE_PORT ?? 5173)
const API_TARGET = process.env.VITE_API_TARGET ?? 'http://localhost:8002'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: PORT,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
      '/media': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Librerías pesadas y de baja frecuencia de cambio: se cachean
          // aparte para no invalidar el chunk principal en cada deploy.
          if (id.includes('node_modules/recharts')) return 'charts'
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/react-router/')) return 'react-router'
          if (id.includes('node_modules/radix-ui')) return 'radix'
          if (id.includes('node_modules/lucide-react')) return 'icons'
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'react'
          return undefined
        },
      },
    },
  },
})