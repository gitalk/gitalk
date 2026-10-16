import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { mount } from './mount'
import type { GitalkOptions } from './types'

/**
 * Regression tests for the "comments and replies disappear" report.
 * Root causes covered: replies dropped from the UI, pagination ignored.
 */
const REST = [
  { id: 100, node_id: 'n100', user: { login: 'alice', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>TOP LEVEL ONE</p>', created_at: new Date(Date.now()-7200000).toISOString(),
    html_url: 'h', parent_id: null, child_comment_count: 2, reactions: { total_count: 1, heart: 1 } },
  { id: 101, node_id: 'n101', user: { login: 'bob', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>REPLY TO 100</p>', created_at: new Date(Date.now()-3600000).toISOString(),
    html_url: 'h', parent_id: 100, child_comment_count: 0, reactions: { total_count: 0, heart: 0 } },
  { id: 102, node_id: 'n102', user: { login: 'carol', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>REPLY 2 TO 100</p>', created_at: new Date(Date.now()-1800000).toISOString(),
    html_url: 'h', parent_id: 100, child_comment_count: 0, reactions: { total_count: 3, heart: 3 } },
  { id: 103, node_id: 'n103', user: { login: 'dave', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>TOP LEVEL TWO</p>', created_at: new Date(Date.now()-600000).toISOString(),
    html_url: 'h', parent_id: null, child_comment_count: 0, reactions: { total_count: 0, heart: 0 } },
]

const thread = { number: 442, node_id: 'D442', title: 'demo', html_url: 'u', locked: false, comments: 4 }

describe('comment loading completeness', () => {
  let host: HTMLElement
  const orig = globalThis.fetch

  beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host) })
  afterEach(() => { globalThis.fetch = orig; render(null, host); host.remove() })

  function stub() {
    globalThis.fetch = vi.fn(async (input: any) => {
      const url = String(input)
      const body = url.includes('/comments') ? REST
        : url.includes('/discussions/442') ? thread : {}
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any
  }

  it('renders every top-level comment and every reply', async () => {
    stub()
    mount(host, { clientID: 'c', owner: 'gitalk', repo: 'gitalk', admin: [], number: 442, id: 'p', perPage: 10 } as GitalkOptions)
    await waitFor(() => host.querySelector('.gt-comment-replies'))

    // 2 top-level comments visible
    const topLevel = host.querySelectorAll('.gt-comments > .gt-comment')
    expect(topLevel.length).toBe(2)
    // replies nested, not dropped
    expect(host.querySelectorAll('.gt-comment-reply-item').length).toBe(2)
    expect(host.textContent).toContain('REPLY TO 100')
    expect(host.textContent).toContain('REPLY 2 TO 100')
    expect(host.textContent).toContain('TOP LEVEL ONE')
    expect(host.textContent).toContain('TOP LEVEL TWO')
  })

  it('does not reuse the absolutely-positioned reply-button class for reply content', async () => {
    stub()
    mount(host, { clientID: 'c', owner: 'gitalk', repo: 'gitalk', admin: [], number: 442, id: 'p', perPage: 10 } as GitalkOptions)
    await waitFor(() => host.querySelector('.gt-comment-replies'))

    // The bug: reply bodies carried .gt-comment-reply (position:absolute)
    const misclassed = host.querySelectorAll('.gt-comment-reply-item.gt-comment-reply')
    expect(misclassed.length).toBe(0)
    const items = host.querySelectorAll('.gt-comment-reply-item')
    for (const el of items) {
      const pos = getComputedStyle(el).position
      expect(pos).not.toBe('absolute')
    }
  })

  it('opens on the newest block and pages backwards, because the API ignores direction', async () => {
    // Eight top-level comments, one hour apart, in the ascending order the
    // REST endpoint always returns (it ignores `direction`).
    const EIGHT = Array.from({ length: 8 }, (_, i) => ({
      id: 200 + i,
      node_id: `n${200 + i}`,
      user: { login: 'alice', avatar_url: 'a', html_url: 'u' },
      body_html: `<p>NUMBER ${i}</p>`,
      created_at: new Date(Date.UTC(2024, 0, 1) + i * 3_600_000).toISOString(),
      html_url: 'h',
      parent_id: null,
      child_comment_count: 0,
      reactions: { total_count: 0, heart: 0 }
    }))
    const thread = { number: 442, node_id: 'D442', title: 'demo', html_url: 'u', locked: false, comments: 8 }

    const calls: string[] = []
    globalThis.fetch = vi.fn(async (input: any) => {
      const url = String(input)
      calls.push(url)
      if (url.includes('/comments')) {
        const params = new URL(url, 'http://x').searchParams
        const p = Number(params.get('page') ?? '1')
        const slice = p === 1 ? EIGHT.slice(0, 4) : EIGHT.slice(4)
        const link =
          p === 1
            ? '<https://api.github.com/x?per_page=4&page=2>; rel="next", <https://api.github.com/x?per_page=4&page=2>; rel="last"'
            : '<https://api.github.com/x?per_page=4&page=1>; rel="prev", <https://api.github.com/x?per_page=4&page=2>; rel="last"'
        return new Response(JSON.stringify(slice), {
          status: 200,
          headers: { 'Content-Type': 'application/json', Link: link }
        })
      }
      return new Response(JSON.stringify(thread), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as any

    mount(host, { clientID: 'c', owner: 'gitalk', repo: 'gitalk', admin: [], number: 442, id: 'p', perPage: 4 } as GitalkOptions)
    await waitFor(() => host.querySelector('.gt-comment-body'))

    // The first screen is the LAST server page: newest comment on top.
    const first = calls.find((c) => c.includes('/comments'))!
    expect(first).toContain('page=2')
    expect(first).toContain('per_page=4')
    expect(host.textContent).toContain('NUMBER 7')
    const rendered = [...host.querySelectorAll('.gt-comment-body')].map((el) => el.textContent)
    expect(rendered[0]).toContain('NUMBER 7')
    expect(rendered[1]).toContain('NUMBER 6')

    // "Load more" walks back in time: the older block is server page 1.
    const btn = host.querySelector('.gt-btn-loadmore') as HTMLButtonElement | null
    expect(btn).toBeTruthy()
    btn!.click()
    await new Promise((r) => setTimeout(r, 60))
    const second = calls.filter((c) => c.includes('/comments')).at(-1)!
    expect(second).toContain('page=1')
    // ...and the older comments land *below* the newer ones.
    expect(host.textContent).toContain('NUMBER 0')
    const after = [...host.querySelectorAll('.gt-comment-body')].map((el) => el.textContent)
    expect(after.indexOf('NUMBER 7')).toBeLessThan(after.indexOf('NUMBER 0'))
  })
})

async function waitFor(pred: () => Element | null, timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (pred()) return
    await new Promise(r => setTimeout(r, 0))
  }
  throw new Error('timed out waiting for widget')
}
