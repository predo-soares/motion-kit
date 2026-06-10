import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()], include: /\.[jt]sx$/ }),
  ],
  optimizeDeps: {
    include: ['lit', 'gsap'],
  },
})
