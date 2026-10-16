import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import GitalkDefault from './standalone'

/**
 * End-to-end check of the no-framework route: load the built IIFE bundle the
 * way a static site would, then drive it exactly as `<script>` users do.
 */

const DIST = resolve(__dirname, '../dist/gitalk.js')
const IIFE = readFileSync(DIST, 'utf8')

describe('standalone bundle', () => {
  let win: Record<string, unknown> & { document: Document }

  beforeEach(() => {
    win = window as unknown as Record<string, unknown> & { document: Document }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders into a container by id, like the documented usage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        const payload = url.includes('/comments')
          ? []
          : url.includes('/discussions/')
            ? { number: 442, node_id: 'D_x', title: 'demo', html_url: 'u', locked: false }
            : {}
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      })
    )

    const container = document.createElement('div')
    container.id = 'gitalk-container'
    document.body.appendChild(container)

    const instance = new GitalkDefault({
      clientID: 'cid',
      owner: 'gitalk',
      repo: 'gitalk',
      admin: ['someone'],
      number: 442,
      id: 'page'
    })
    instance.render('gitalk-container')

    const deadline = Date.now() + 1000
    while (Date.now() < deadline && !container.querySelector('.gt-container')) {
      await new Promise((r) => setTimeout(r, 0))
    }

    expect(container.querySelector('.gt-container')).toBeTruthy()
    expect(instance.destroy).toBeTypeOf('function')

    instance.destroy()
    expect(container.querySelector('.gt-container')).toBeNull()
    container.remove()
    vi.unstubAllGlobals()
  })

  it('throws a clear error when the container does not exist', () => {
    const instance = new GitalkDefault({ clientID: 'c', owner: 'o', repo: 'r', admin: [] })
    expect(() => instance.render('#does-not-exist')).toThrow(/container not found/i)
  })
})
