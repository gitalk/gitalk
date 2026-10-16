import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Verifies the published artefact rather than the source modules: evaluate the
 * built IIFE exactly the way `<script src="gitalk.js">` would, and confirm it
 * leaves a usable `window.Gitalk` behind.
 */
const DIST = resolve(__dirname, '../dist/gitalk.js')
const IIFE = readFileSync(DIST, 'utf8')

describe('published IIFE bundle', () => {
  it('exposes window.Gitalk after evaluating like a page script', () => {
    const page: Record<string, unknown> = { console }
    page.window = page
    page.globalThis = page
    page.self = page
    // eslint-disable-next-line no-new-func
    new Function('window', 'globalThis', 'self', 'console', IIFE)(
      page,
      page,
      page,
      console
    )
    expect(typeof page.Gitalk).toBe('function')
  })

  it('survives evaluation twice without error', () => {
    const page: Record<string, unknown> = { console }
    page.window = page
    page.globalThis = page
    page.self = page
    const run = () =>
      // eslint-disable-next-line no-new-func
      new Function('window', 'globalThis', 'self', 'console', IIFE)(page, page, page, console)
    run()
    expect(run).not.toThrow()
  })
})
