import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

const CORE_SRC = resolve(import.meta.dirname, '../../packages/core/src')

/**
 * Landing page build. Emits a fully static site consumed by the gh-pages
 * deploy job in `.github/workflows/deploy-pages.yml`.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The site is served from the bare domain (gitalk.github.io). A relative
  // base keeps the same build valid if it ever moves back under a subpath.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: [
      // Styles first: a bare substring alias would also swallow
      // `@aifire/gitalk/style.css` and point it at index.ts.
      //
      // These point at source so the landing page always reflects the working
      // tree, and so it builds without `packages/core` having been built.
      { find: /^@aifire\/gitalk\/style\.css$/, replacement: resolve(CORE_SRC, 'styles/index.css') },
      { find: /^@aifire\/gitalk$/, replacement: resolve(CORE_SRC, 'index.ts') }
    ]
  }
})
