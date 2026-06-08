import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  plugins: [
    react(),
  ],
  optimizeDeps: {
    include: ['lit', 'gsap'],
  },
})
