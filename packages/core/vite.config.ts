import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { resolve } from 'node:path'

/**
 * Library build: dist/index.js (ESM) plus type declarations.
 *
 * The browser-ready `window.Gitalk` bundle is built separately by
 * vite.iife.config.ts, because Preact 11 ships only ESM and no longer
 * provides a UMD bundle to lean on. See docs/tech.md §6.2.
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
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.js'
    },
    cssCodeSplit: false
  }
})
