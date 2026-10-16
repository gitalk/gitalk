import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { mount } from './mount'
import { GitalkWidget } from './widget'
import type { GitalkOptions } from './types'
import { formatRelativeTime } from './time'
import { createTranslator } from './i18n'

const OPTIONS: GitalkOptions = {
  clientID: 'client-id',
  repo: 'gitalk',
  owner: 'gitalk',
  admin: ['booxood'],
  id: 'page-id',
  number: 442
}

/**
 * Shaped exactly like the live REST response for `/discussions/{n}/comments`:
 * snake_case fields, `body_html`, and replies interleaved with top-level rows
 * via `parent_id` (see docs/tech.md §2.3).
 */
const REST_COMMENTS = [
  {
    id: 523955,
    node_id: 'MDE3OkRpc2N1c3Npb25Db21tZW50NTIzOTU1',
    user: { login: 'booxood', avatar_url: 'https://avatars.test/1', html_url: 'https://github.com/booxood' },
    body_html: '<p>配置贴出来看下？</p>',
    created_at: new Date(Date.now() - 60_000).toISOString(),
    html_url: 'https://github.com/gitalk/gitalk/discussions/442#discussioncomment-523955',
    parent_id: null,
    child_comment_count: 1,
    reactions: { total_count: 2, heart: 2 }
  },
  {
    id: 3485634,
    node_id: 'MDE3OkRpc2N1c3Npb25Db21tZW50MzQ4NTYzNA==',
    user: { login: 'sisyphus1212', avatar_url: 'https://avatars.test/3', html_url: 'https://github.com/sisyphus1212' },
    body_html: '<p>a reply</p>',
    created_at: new Date(Date.now() - 30_000).toISOString(),
    html_url: 'https://github.com/gitalk/gitalk/discussions/442#discussioncomment-3485634',
    parent_id: 523955,
    child_comment_count: 0,
    reactions: { total_count: 0, heart: 0 }
  }
]

function stubFetch(handler: (url: string) => unknown) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String(input)
    const body = handler(url)
    return new Response(JSON.stringify(body ?? {}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }) as typeof fetch
}

describe('GitalkWidget', () => {
  let host: HTMLElement
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    render(null, host)
    host.remove()
  })

  it('renders comment bodies and nested replies', async () => {
    stubFetch((url) => {
      if (url.includes('/graphql')) return {}
      if (url.includes('/user')) return { login: 'booxood', avatar_url: 'https://avatars.test/1' }
      if (url.includes('/comments')) return REST_COMMENTS
      if (url.includes('/discussions/442')) {
        return { number: 442, node_id: 'D_442', title: 'demo', html_url: 'https://github.com/x', locked: false }
      }
      return {}
    })

    mount(host, OPTIONS)
    await waitForComment(host)

    expect(host.querySelector('.gt-container')).toBeTruthy()
    expect(host.querySelectorAll('.gt-comment').length).toBeGreaterThanOrEqual(2)
    // Body HTML is injected as-is; GitHub already sanitised it upstream.
    expect(host.querySelector('.gt-comment-body')?.innerHTML).toContain('配置贴出来看下？')
    expect(host.textContent).toContain('sisyphus1212')
    expect(host.querySelector('.gt-comment-replies')).toBeTruthy()
  })

  it('shows the empty state instead of a blank box when there are no comments', async () => {
    stubFetch((url) => {
      if (url.includes('/comments')) return []
      if (url.includes('/discussions/442')) {
        return { number: 442, node_id: 'D_442', title: 'demo', html_url: 'https://github.com/x', locked: false }
      }
      return {}
    })

    mount(host, OPTIONS)
    await waitFor(host)

    expect(host.querySelector('.gt-comments-null')).toBeTruthy()
    expect(host.querySelectorAll('.gt-comment').length).toBe(0)
  })

  it('surfaces the rate limit hint when GitHub returns 429', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 429 })) as typeof fetch

    mount(host, OPTIONS)
    await waitFor(host)

    expect(host.querySelector('.gt-error')).toBeTruthy()
    expect(host.textContent).toContain('60/hour')
  })

  it('mounts and unmounts cleanly for React/Vue parity', async () => {
    stubFetch((url) => (url.includes('/comments') ? [] : {}))
    const instance = mount(host, OPTIONS)
    await waitFor(host)
    expect(host.querySelector('.gt-container')).toBeTruthy()

    instance.unmount()
    await tick()
    expect(host.querySelector('.gt-container')).toBeNull()
  })
  it('counts replies in the total and never renders the plural separator', async () => {
    stubFetch((url) => {
      if (url.includes('/comments')) return REST_COMMENTS
      if (url.includes('/discussions/442')) {
        return { number: 442, node_id: 'D_442', title: 'demo', html_url: 'https://github.com/x', locked: false }
      }
      return {}
    })
    mount(host, OPTIONS)
    await waitForComment(host)

    // REST_COMMENTS holds one top-level comment and one reply. Counting only
    // the top-level array — which is what the widget used to do — reported 1,
    // so 2 is the value that proves replies are included.
    const counts = host.querySelector('.gt-counts')
    expect(counts?.textContent).toContain('2')
    // The dictionary migrated v1's `singular |||| plural` pair; the separator
    // used to reach the page verbatim.
    expect(counts?.textContent).not.toContain('||||')
  })

  it('reports the rendered count to updateCountCallback, replies included', async () => {
    stubFetch((url) => {
      if (url.includes('/comments')) return REST_COMMENTS
      if (url.includes('/discussions/442')) {
        return { number: 442, node_id: 'D_442', title: 'demo', html_url: 'https://github.com/x', locked: false }
      }
      return {}
    })

    const reported: number[] = []
    mount(host, { ...OPTIONS, updateCountCallback: (n) => reported.push(n) })
    await waitForComment(host)

    // One top-level comment plus one reply: the UI says 2, so the callback has
    // to say 2 too. It used to receive the top-level array length (1), which
    // meant any thread with replies reported a smaller number than the page.
    expect(host.querySelector('.gt-counts')?.textContent).toContain('2')
    expect(reported.at(-1)).toBe(2)
  })

  it('accumulates the count across loaded pages, replies included', async () => {
    stubFetch((url) => {
      if (url.includes('/comments')) {
        const page = Number(new URL(url, 'http://x').searchParams.get('page') ?? '1')
        // Page 1 (REST_COMMENTS) is one comment + one reply and fills the page
        // size, so "load more" appears; page 2 adds one comment and two replies.
        return page === 1
          ? REST_COMMENTS
          : [
              { ...REST_COMMENTS[0]!, id: 1000, parent_id: null, body_html: '<p>page two</p>' },
              { ...REST_COMMENTS[1]!, id: 1001, parent_id: 1000, body_html: '<p>reply a</p>' },
              { ...REST_COMMENTS[1]!, id: 1002, parent_id: 1000, body_html: '<p>reply b</p>' }
            ]
      }
      if (url.includes('/discussions/442')) {
        return { number: 442, node_id: 'D_442', title: 'demo', html_url: 'https://github.com/x', locked: false }
      }
      return {}
    })

    const reported: number[] = []
    mount(host, { ...OPTIONS, perPage: 2, updateCountCallback: (n) => reported.push(n) })
    await waitForComment(host)
    expect(reported.at(-1)).toBe(2)

    const button = host.querySelector('.gt-btn-loadmore') as HTMLButtonElement | null
    expect(button).toBeTruthy()
    button!.click()
    await tick()
    await tick()

    // 2 from page 1 + 3 from page 2 — the widget's own `.gt-counts` value.
    expect(host.querySelector('.gt-counts')?.textContent).toContain('5')
    expect(reported.at(-1)).toBe(5)
  })

})

describe('formatRelativeTime', () => {
  it('describes recent timestamps in the past tense', () => {
    const ago = new Date(Date.now() - 5 * 60_000).toISOString()
    expect(formatRelativeTime(ago, 'en')).toMatch(/ago|minutes?/i)
  })

  it('accepts the zh-CN locale without throwing', () => {
    const ago = new Date(Date.now() - 60_000).toISOString()
    expect(() => formatRelativeTime(ago, 'zh-CN')).not.toThrow()
  })

  it('does not render "NaN" for an unparseable date', () => {
    expect(formatRelativeTime('not-a-date')).not.toContain('NaN')
  })
})

describe('translator', () => {
  it('interpolates %{key} placeholders like v1 did', () => {
    const t = createTranslator('en')
    expect(t('please-contact', { user: '@alice' })).toContain('@alice')
  })

  it('falls back to English for an unknown or partial locale', () => {
    expect(createTranslator('xx-YY')('comment')).toBe('Comment')
    expect(createTranslator('zh')('comment')).toBe('评论')
  })
})

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/** Wait until the widget has actually produced DOM, rather than guessing ticks. */
async function waitForComment(host: HTMLElement, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (host.querySelector('.gt-comment-body')) return
    await tick()
  }
  throw new Error(`no comments rendered:\n${host.innerHTML.slice(0, 400)}`)
}

async function waitFor(host: HTMLElement, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (host.querySelector('.gt-comments, .gt-comments-null, .gt-no-init, .gt-error')) return
    await tick()
  }
  throw new Error(`widget never rendered:\n${host.innerHTML.slice(0, 400)}`)
}
