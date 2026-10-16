import Gitalk from './standalone'

/**
 * IIFE-only entry point. Vite builds this file into `dist/gitalk.js`, whose
 * Rollup wrapper would otherwise bind exports to an internal namespace object
 * instead of the page global — so the classic `<script>` usage needs the global
 * published explicitly here.
 *
 * This file is deliberately NOT part of the ESM entry: importing
 * `@gitalk/core` must never write to `window`.
 */
if (typeof globalThis !== 'undefined') {
  ;(globalThis as unknown as { Gitalk?: typeof Gitalk }).Gitalk = Gitalk
}
