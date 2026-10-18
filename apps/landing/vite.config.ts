import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const CORE_SRC = resolve(import.meta.dirname, '../../packages/core/src')

// The landing page imports core's source, so core's own builds never define
// this. Without it here the widget falls back to a hardcoded dev string and
// the page advertises a version that is not the one shipping.
/**
 * The widget's real transfer size, measured from the artifact the page will
 * actually load rather than typed into the source. The numbers here have been
 * stale before: the bundle grew and the claim did not.
 *
 * The deploy workflow builds core before the landing page, so the file exists
 * by then. Locally it may not, and the page falls back to hiding the figure.
 */
function measureWidget(): { raw: string; gzip: string } {
  try {
    const file = readFileSync(resolve(import.meta.dirname, '../../packages/core/dist/gitalk.js'))
    return {
      // kB means 1000 bytes here, matching how the bundler reports sizes,
      // so the page and the build log never disagree by a few tenths.
      raw: (file.byteLength / 1000).toFixed(1),
      gzip: (gzipSync(file, { level: 9 }).byteLength / 1000).toFixed(1)
    }
  } catch {
    return { raw: '', gzip: '' }
  }
}
const widgetSize = measureWidget()

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
    // The published version when the workflow provides it (package.json only
    // ever holds the baseline), falling back to the package for local builds.
    __GITALK_VERSION__: JSON.stringify(process.env.GITALK_VERSION ?? coreVersion),
    // Injected by the deploy workflow (see .github/workflows/deploy-pages.yml);
    // empty locally, where the page falls back to a placeholder.
    __GITALK_STARS__: JSON.stringify(process.env.GITALK_STARS ?? ''),
    __GITALK_GZIP__: JSON.stringify(widgetSize.gzip),
    __GITALK_RAW__: JSON.stringify(widgetSize.raw)
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
