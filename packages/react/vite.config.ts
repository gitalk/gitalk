import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

/**
 * `@aifire/gitalk-react` is a thin wrapper, so it ships as an external-dependency
 * library: React stays a peer dep and `@aifire/gitalk` is resolved by the host's
 * bundler instead of being duplicated.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime', '@aifire/gitalk']
    }
  }
})
