import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Served at https://gitalk.github.io/vue/, so every emitted asset URL must
 * carry that prefix. A wrong `base` shows up as a page of 404s.
 */
export default defineConfig({
  plugins: [vue()],
  base: '/vue/',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
