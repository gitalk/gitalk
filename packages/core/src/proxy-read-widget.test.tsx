import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { mount } from './mount'
import type { GitalkOptions } from './types'
import { TOKEN_STORAGE_KEY } from './auth'

/**
 * End-to-end proof of the two properties this change is judged on:
 *
 *  1. with a configured proxy, an anonymous visitor's reads go to
 *     `<proxy>/graphql` and **never** to api.github.com — so the browser's
 *     60/hr REST allowance is not touched;
 *  2. when that proxy cannot serve the read, the widget falls back to the
 *     original browser-direct REST path and still renders the comments.
 *
 * Both are counted at the fetch boundary rather than inferred from state.
 */

const OPTIONS: GitalkOptions = {
  clientID: 'client-id',
  proxy: 'https://proxy.test',
  owner: 'gitalk',
  repo: 'gitalk',
  admin: [],
  id: 'page-id',
  number: 442,
  perPage: 10
}

const REST_COMMENTS = [
  {
    id: 900,
    node_id: 'n900',
    user: { login: 'rest-reader', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>read over REST</p>',
    created_at: '2024-01-01T00:00:00Z',
    html_url: 'h',
    parent_id: null,
    child_comment_count: 0,
    reactions: { total_count: 0, heart: 0 }
  }
]

const GRAPHQL_COMMENTS = {
  data: {
    repository: {
      discussion: {
        comments: {
          totalCount: 2,
          pageInfo: { hasNextPage: false, hasPreviousPage: false },
          nodes: [
            {
              id: 'DC_1',
              databaseId: 1,
              author: { login: 'proxy-reader', avatarUrl: 'a', url: 'u' },
              createdAt: '2024-01-01T00:00:00Z',
              url: 'h',
              bodyHTML: '<p>read over the proxy</p>',
              reactionGroups: []
            },
            {
              id: 'DC_2',
              databaseId: 2,
              author: { login: 'replier', avatarUrl: 'a', url: 'u' },
              createdAt: '2024-01-02T00:00:00Z',
              url: 'h',
              bodyHTML: '<p>proxy reply</p>',
              reactionGroups: [],
              replies: {
                totalCount: 0,
                nodes: []
              }
            }
          ]
        }
      }
    }
  }
}

const GRAPHQL_THREAD = {
  data: {
    repository: {
      discussion: {
        id: 'D_442',
        number: 442,
        title: 'demo',
        url: 'https://github.com/gitalk/gitalk/discussions/442',
        locked: false
      }
    }
  }
}

interface FetchCall {
  url: string
  authorization: string | null
  query?: string
  variables?: Record<string, unknown>
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function stubFetch(handler: (call: FetchCall) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = []
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers as Record<string, string> | undefined) ?? {}
    const rawBody = typeof init?.body === 'string' ? init.body : undefined
    let parsed: { query?: string; variables?: Record<string, unknown> } | undefined
    if (rawBody) {
      try {
        parsed = JSON.parse(rawBody) as { query?: string; variables?: Record<string, unknown> }
      } catch {
        parsed = undefined
      }
    }
    const call: FetchCall = {
      url: String(input),
      authorization: headers.Authorization ?? null,
      query: parsed?.query,
      variables: parsed?.variables
    }
    calls.push(call)
    return handler(call)
  }) as typeof fetch
  return calls
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function waitForComment(host: HTMLElement, timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (host.querySelector('.gt-comment-body')) return
    await tick()
  }
  throw new Error(`no comments rendered:\n${host.innerHTML.slice(0, 500)}`)
}

describe('anonymous reads through the configured proxy', () => {
  let host: HTMLElement
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    render(null, host)
    host.remove()
  })

  it('sends thread and comment reads to the proxy, never to api.github.com', async () => {
    const calls = stubFetch((call) => {
      if (!call.url.startsWith('https://proxy.test/graphql')) {
        throw new Error(`unexpected browser-direct request: ${call.url}`)
      }
      if (call.query?.includes('gitalkDiscussionComments')) return json(GRAPHQL_COMMENTS)
      if (call.query?.includes('gitalkDiscussion')) return json(GRAPHQL_THREAD)
      return json({ data: {} })
    })

    mount(host, OPTIONS)
    await waitForComment(host)

    expect(host.textContent).toContain('read over the proxy')
    expect(host.textContent).toContain('proxy reply')
    expect(host.querySelector('.gt-counts')?.textContent).toContain('2')

    // The browser's 60/hr REST quota is untouched: every call went to the
    // endpoint that holds the installation token.
    expect(calls.every((call) => call.url.startsWith('https://proxy.test'))).toBe(true)
    expect(calls.some((call) => call.url.includes('api.github.com'))).toBe(false)

    // Anonymous: no visitor token is leaked to (or expected by) the proxy.
    expect(calls.every((call) => call.authorization === null)).toBe(true)

    const commentsRead = calls.find((call) => call.query?.includes('gitalkDiscussionComments'))!
    expect(commentsRead.variables).toMatchObject({ owner: 'gitalk', repo: 'gitalk', number: 442 })
  })

  it('falls back to browser-direct REST when the proxy cannot serve the read', async () => {
    const calls = stubFetch((call) => {
      if (call.url.startsWith('https://proxy.test/graphql')) {
        return json({ error: 'Anonymous reads are unavailable' }, 503)
      }
      if (call.url.includes('/discussions/442/comments')) return json(REST_COMMENTS)
      if (call.url.includes('/discussions/442')) {
        return json({
          number: 442,
          node_id: 'D_442',
          title: 'demo',
          html_url: 'https://github.com/x',
          locked: false
        })
      }
      return json({})
    })

    mount(host, OPTIONS)
    await waitForComment(host)

    expect(host.querySelector('.gt-comment-body')?.innerHTML).toContain('read over REST')
    expect(calls.some((call) => call.url.includes('api.github.com'))).toBe(true)

    // The circuit breaker means the failed endpoint is not retried for every
    // later read in the same widget.
    expect(calls.filter((call) => call.url.startsWith('https://proxy.test'))).toHaveLength(1)
  })

  it('keeps the original REST path when no proxy option is configured', async () => {
    const calls = stubFetch((call) => {
      if (call.url.includes('/comments')) return json(REST_COMMENTS)
      if (call.url.includes('/discussions/442')) {
        return json({
          number: 442,
          node_id: 'D_442',
          title: 'demo',
          html_url: 'https://github.com/x',
          locked: false
        })
      }
      return json({})
    })

    mount(host, { ...OPTIONS, proxy: undefined })
    await waitForComment(host)

    expect(host.querySelector('.gt-comment-body')?.innerHTML).toContain('read over REST')
    // No proxy option: the widget must not send read traffic to the hosted
    // default endpoint just because sign-in would have used it.
    expect(calls.some((call) => call.url.includes('/graphql'))).toBe(false)
    expect(calls.every((call) => call.url.includes('api.github.com'))).toBe(true)
  })
})
