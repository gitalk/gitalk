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
  // Relative base so the same build works under /gitalk/ (project Pages)
  // and at the site root (gitalk/gitalk.github.io).
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: [
      // Styles first: a bare substring alias would also swallow
      // `@gitalk/core/style.css` and point it at index.ts.
      { find: /^@gitalk\/core\/style\.css$/, replacement: resolve(CORE_SRC, 'styles/index.css') },
      { find: /^@gitalk\/core$/, replacement: resolve(CORE_SRC, 'index.ts') }
    ]
  }
})
