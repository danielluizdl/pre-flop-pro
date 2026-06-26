import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        // Mantém o seed síncrono (import estático) mas tira o JSON de 1.4MB do chunk principal
        manualChunks(id) {
          if (id.includes('adminRanges.json')) return 'admin-ranges'
          if (id.includes('node_modules')) {
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) {
              return 'vendor-react'
            }
            if (/[\\/]node_modules[\\/]@sentry/.test(id)) return 'vendor-sentry'
            return 'vendor'
          }
        },
      },
    },
  },
})
