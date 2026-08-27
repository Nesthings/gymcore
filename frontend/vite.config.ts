import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5179,
    proxy: {
      '/api': {
        target: 'http://localhost:8009',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://localhost:8009',
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