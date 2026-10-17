import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const CORE_SRC = resolve(import.meta.dirname, '../../packages/core/src')

// The landing page imports core's source, so core's own builds never define
// this. Without it here the widget falls back to a hardcoded dev string and
// the page advertises a version that is not the one shipping.
const coreVersion = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../packages/core/package.json'), 'utf8')
).version as string

/**
 * Landing page build. Emits a fully static site consumed by the gh-pages
 * deploy job in `.github/workflows/deploy-pages.yml`.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __GITALK_VERSION__: JSON.stringify(coreVersion),
    // Injected by the deploy workflow (see .github/workflows/deploy-pages.yml);
    // empty locally, where the page falls back to a placeholder.
    __GITALK_STARS__: JSON.stringify(process.env.GITALK_STARS ?? '')
  },
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
