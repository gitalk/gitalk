import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Served at https://gitalk.github.io/react/, so every emitted asset URL must
 * carry that prefix. A wrong `base` shows up as a page of 404s.
 */
export default defineConfig({
  plugins: [react()],
  base: '/react/',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
