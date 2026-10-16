import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { mount } from './mount'
import type { GitalkOptions } from './types'

/**
 * Regression tests for the reported ordering bug: the landing page showed
 * comments oldest-first.
 *
 * Root cause (measured against api.github.com, not guessed): GitHub's REST
 * comment endpoints **ignore the `direction` query parameter**. For
 * `/repos/gitalk/gitalk/discussions/442/comments`, `direction=asc`,
 * `direction=desc` and no parameter at all return byte-identical ascending
 * payloads, and the same holds for `/issues/1/comments`. The widget asked for
 * `direction=desc` and rendered whatever came back, so it rendered the payload's
 * own (ascending) order.
 *
 * The fix is client-side: the backends derive the order and read the
 * newest-first window from the *last* offset page. These tests pin the
 * user-visible result — the payload below is deliberately in the ascending order
 * the API really returns.
 */
const ASCENDING = [
  {
    id: 1,
    node_id: 'n1',
    user: { login: 'oldest', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>OLDEST</p>',
    created_at: '2021-01-01T00:00:00Z',
    html_url: 'h',
    parent_id: null,
    child_comment_count: 1,
    reactions: { total_count: 0, heart: 0 }
  },
  {
    id: 2,
    node_id: 'n2',
    user: { login: 'middle', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>MIDDLE</p>',
    created_at: '2022-01-01T00:00:00Z',
    html_url: 'h',
    parent_id: null,
    child_comment_count: 0,
    reactions: { total_count: 0, heart: 0 }
  },
  {
    id: 3,
    node_id: 'n3',
    user: { login: 'newest', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>NEWEST</p>',
    created_at: '2023-01-01T00:00:00Z',
    html_url: 'h',
    parent_id: null,
    child_comment_count: 0,
    reactions: { total_count: 0, heart: 0 }
  },
  {
    // Reply to the oldest comment, created last: replies stay chronological
    // under their parent, they do not float to the top of the thread.
    id: 4,
    node_id: 'n4',
    user: { login: 'replier', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>OLDEST-REPLY</p>',
    created_at: '2024-01-01T00:00:00Z',
    html_url: 'h',
    parent_id: 1,
    child_comment_count: 0,
    reactions: { total_count: 0, heart: 0 }
  }
]

const THREAD = {
  number: 442,
  node_id: 'D442',
  title: 'demo',
  html_url: 'u',
  locked: false,
  comments: ASCENDING.length
}

describe('comment ordering', () => {
  let host: HTMLElement
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes('/comments')
        ? ASCENDING
        : url.includes('/discussions/442')
          ? THREAD
          : {}
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }) as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    render(null, host)
    host.remove()
  })

  async function mountWidget(extra: Partial<GitalkOptions> = {}) {
    mount(host, {
      clientID: 'c',
      owner: 'gitalk',
      repo: 'gitalk',
      admin: [],
      number: 442,
      id: 'p',
      perPage: 10,
      ...extra
    } as GitalkOptions)
    await waitFor(() => host.querySelector('.gt-comment-body'))
  }

  function topLevelText(): string[] {
    return [...host.querySelectorAll('.gt-comments > .gt-comment')].map(
      (el) => el.querySelector('.gt-comment-body')?.textContent ?? ''
    )
  }

  it('renders the newest comment first, whatever order the payload arrived in', async () => {
    await mountWidget()
    expect(topLevelText()).toEqual(['NEWEST', 'MIDDLE', 'OLDEST'])
  })

  it('keeps replies chronological under their parent instead of inverting them', async () => {
    await mountWidget()
    const oldest = [...host.querySelectorAll('.gt-comments > .gt-comment')].at(-1)!
    const replies = [...oldest.querySelectorAll('.gt-comment-reply-item')].map(
      (el) => el.querySelector('.gt-comment-body')?.textContent
    )
    expect(replies).toEqual(['OLDEST-REPLY'])
  })

  it('honours sortDirection: "first" for sites that want the old end first', async () => {
    await mountWidget({ sortDirection: 'first' })
    expect(topLevelText()).toEqual(['OLDEST', 'MIDDLE', 'NEWEST'])
  })
})

async function waitFor(pred: () => Element | null, timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (pred()) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('timed out waiting for widget')
}
