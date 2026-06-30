import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: '/',
  build: {
    rollupOptions: {
      output: {
        // Mantém o seed síncrono (import estático) mas tira o JSON de 1.4MB do chunk principal
        manualChunks(id) {
          if (id.includes('adminRanges.json')) return 'admin-ranges'
          if (id.includes('node_modules')) {
            // Só react/react-dom/scheduler (sem deps externas) ficam no vendor-react.
            // react-router puxa @remix-run/router (que cai em 'vendor'); juntá-lo aqui
            // criava ciclo vendor<->vendor-react e quebrava o React no browser (forwardRef undefined).
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
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
