import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const packageVersion = JSON.parse(
  readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8')
).version as string

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
      config: () => ({
        // Read from package.json rather than hardcoding: the literal here
        // drifted three releases behind the published version.
        define: { __GITALK_VERSION__: JSON.stringify(packageVersion) }
      })
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
