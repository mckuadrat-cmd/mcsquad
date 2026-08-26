import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@hello-pangea/dnd']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts')) return 'vendor-charts';
            if (id.includes('@fullcalendar')) return 'vendor-calendar';
            if (id.includes('lucide-react')) return 'vendor-icons';
            return 'vendor-others';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000 // Menaikkan limit peringatan setelah optimasi
  }
})
