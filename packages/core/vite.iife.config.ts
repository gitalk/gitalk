import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { resolve } from 'node:path'

/**
 * Standalone IIFE bundle for `<script>` users, separate from the ESM library
 * entry so consumers get one global (`window.Gitalk`) rather than a namespace
 * object of named exports.
 */
export default defineConfig({
  plugins: [preact()],
  define: {
    __GITALK_VERSION__: JSON.stringify(process.env.npm_package_version ?? '2.0.0')
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/global-entry.ts'),
      formats: ['iife'],
      name: 'Gitalk',
      fileName: () => 'gitalk.js'
    },
    cssCodeSplit: false
  }
})
