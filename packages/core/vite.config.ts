import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { resolve } from 'node:path'

/**
 * Library build with two outputs:
 *
 *  - dist/index.js    ESM, for bundlers and the React/Vue wrappers
 *  - dist/gitalk.js   IIFE exposing `window.Gitalk`, for plain `<script>` users
 *
 * The explicit IIFE entry matters: Preact 11 ships only ESM, so unlike v1 we
 * cannot lean on Preact's erstwhile UMD bundle to produce a global. See
 * docs/tech.md §6.2.
 *
 * Rollup's IIFE wrapper receives its scope object from the runtime
 * (`globalThis` here); without `globals`, the export list would still be
 * written onto an empty `{}` and never reach `window`.
 */
export default defineConfig({
  plugins: [preact()],
  define: {
    __GITALK_VERSION__: JSON.stringify(process.env.npm_package_version ?? '2.0.0')
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'iife'],
      name: 'Gitalk',
      fileName: (format) => (format === 'iife' ? 'gitalk.js' : 'index.js')
    },
    cssCodeSplit: false
  }
})
