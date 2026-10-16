import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { resolve } from 'node:path'

/**
 * Standalone IIFE bundle for `<script src="gitalk.js">` users, kept separate
 * from the ESM entry so that:
 *  - consumers get one global (`window.Gitalk`) instead of a namespace object
 *  - importing `@aifire/gitalk` as ESM never has the side effect of clobbering
 *    a page global (see src/global-entry.ts)
 */
export default defineConfig({
  plugins: [
    preact(),
    {
      name: 'gitalk-version',
      config: () => ({ define: { __GITALK_VERSION__: JSON.stringify('2.0.0') } })
    }
  ],
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
