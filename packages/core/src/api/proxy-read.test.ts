import { describe, expect, it, vi } from 'vitest'
import { DiscussionsBackend } from './discussions'
import { IssuesBackend } from './issues'
import type { BackendContext, GraphqlReadComment } from './backend'
import type { HttpClient } from './client'
import type { ThreadInfo } from '../types'
import {
  DISCUSSION_COMMENTS_QUERY,
  DISCUSSION_LIST_QUERY,
  DISCUSSION_THREAD_QUERY,
  ISSUE_COMMENTS_QUERY
} from './read-queries'

/**
 * The REST tests pin the fallback path. These pin the accelerator: when the
 * proxy answers, the browser must not touch api.github.com at all, and the
 * GraphQL cursor pages must line up with the widget's logical page numbers.
 */

const THREAD: ThreadInfo = {
  kind: 'discussions',
  number: 442,
  title: 'demo',
  url: 'https://github.com/gitalk/gitalk/discussions/442',
  nodeId: 'D_kwDO',
  locked: false
}

const REST_ROW = {
  id: 1,
  node_id: 'DC_rest_1',
  user: { login: 'rest', avatar_url: 'a', html_url: 'u' },
  body_html: '<p>from REST</p>',
  created_at: '2024-01-01T00:00:00Z',
  html_url: 'h',
  parent_id: null,
  reactions: { total_count: 0 }
}

function makeCtx(overrides: Partial<BackendContext> = {}): BackendContext {
  const get = vi.fn()
  return {
    http: {
      get,
      getWithLinks: vi.fn(async (path: string, init?: unknown) => ({
        data: await get(path, init),
        links: { first: null, prev: null, next: null, last: null }
      })),
      post: vi.fn(),
      request: vi.fn()
    } as unknown as HttpClient,
    getToken: () => null,
    owner: 'gitalk',
    repo: 'gitalk',
    getThread: () => THREAD,
    term: () => '/page',
    graphql: (async () => {
      throw new Error('the visitor GraphQL path must not be used for anonymous reads')
    }) as BackendContext['graphql'],
    ...overrides
  }
}

function node(overrides: Partial<GraphqlReadComment>): GraphqlReadComment {
  return {
    id: 'DC_1',
    databaseId: 1,
    author: { login: 'alice', avatarUrl: 'a', url: 'u' },
    createdAt: '2024-01-01T00:00:00Z',
    url: 'h',
    bodyHTML: '<p>old</p>',
    reactionGroups: [],
    ...overrides
  }
}

interface ReadCall {
  body: { query: string; variables: Record<string, unknown> }
  options?: { fresh?: boolean }
}

/**
 * A typed stand-in for `BackendContext.proxyRead` that records the documents
 * and variables it was called with. Returns `pages` in order and then repeats
 * the last one; pass `null` for the "proxy could not answer" case.
 */
function proxyReadMock(...pages: Array<unknown | null>): {
  read: NonNullable<BackendContext['proxyRead']>
  calls: ReadCall[]
} {
  const calls: ReadCall[] = []
  let index = 0
  const read = (async <T,>(
    body: { query: string; variables: Record<string, unknown> },
    options?: { fresh?: boolean }
  ): Promise<T | null> => {
    calls.push({ body, options })
    const page = pages[Math.min(index++, pages.length - 1)] ?? null
    return page as T | null
  }) as NonNullable<BackendContext['proxyRead']>
  return { read, calls }
}

const COMMENTS_PAGE = {
  repository: {
    discussion: {
      comments: {
        totalCount: 2,
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: true,
          startCursor: 'start-page-1',
          endCursor: 'end-page-1'
        },
        nodes: [
          node({
            id: 'DC_old',
            databaseId: 10,
            createdAt: '2024-01-01T00:00:00Z',
            bodyHTML: '<p>old</p>',
            replies: {
              totalCount: 1,
              nodes: [
                node({
                  id: 'DC_reply',
                  databaseId: 11,
                  createdAt: '2024-01-02T00:00:00Z',
                  bodyHTML: '<p>reply</p>'
                })
              ]
            }
          }),
          node({
            id: 'DC_new',
            databaseId: 12,
            createdAt: '2024-02-01T00:00:00Z',
            bodyHTML: '<p>new</p>',
            reactionGroups: [
              { content: 'HEART', viewerHasReacted: false, reactors: { totalCount: 3 } }
            ]
          })
        ]
      }
    }
  }
}

describe('DiscussionsBackend anonymous proxy reads', () => {
  it('reads a page through the proxy and never calls REST', async () => {
    const proxy = proxyReadMock(COMMENTS_PAGE)
    const ctx = makeCtx({ proxyRead: proxy.read })

    const page = await new DiscussionsBackend(ctx).getComments({
      first: 10,
      direction: 'last'
    })

    // Newest first, replies nested under their parent.
    expect(page.comments.map((c) => c.id)).toEqual([12, 10])
    expect(page.comments[1]!.replies.map((r) => r.id)).toEqual([11])
    // Two top-level + one reply, matching the widget's `.gt-counts` metric.
    expect(page.totalCount).toBe(3)
    expect(page.hasNextPage).toBe(true)
    expect(vi.mocked(ctx.http.get)).not.toHaveBeenCalled()

    expect(proxy.calls[0]!.body.query).toBe(DISCUSSION_COMMENTS_QUERY)
    expect(proxy.calls[0]!.body.variables).toMatchObject({
      owner: 'gitalk',
      repo: 'gitalk',
      number: 442,
      last: 10,
      first: null,
      before: null
    })
  })

  it('translates logical page 2 to the before-cursor of page 1', async () => {
    const secondPage = {
      repository: {
        discussion: {
          comments: {
            totalCount: 2,
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: 'start-page-2',
              endCursor: 'end-page-2'
            },
            nodes: [node({ id: 'DC_older', databaseId: 5 })]
          }
        }
      }
    }
    const proxy = proxyReadMock(COMMENTS_PAGE, secondPage)
    const ctx = makeCtx({ proxyRead: proxy.read })
    const backend = new DiscussionsBackend(ctx)

    await backend.getComments({ first: 10, direction: 'last', page: 1 })
    const page2 = await backend.getComments({ first: 10, direction: 'last', page: 2 })

    expect(proxy.calls[1]!.body.variables).toMatchObject({
      before: 'start-page-1',
      after: null,
      last: 10,
      first: null
    })
    expect(page2.comments.map((c) => c.id)).toEqual([5])
    expect(page2.hasNextPage).toBe(false)
  })

  it('falls back to the REST path when the proxy read returns null', async () => {
    const ctx = makeCtx({ proxyRead: proxyReadMock(null).read })
    vi.mocked(ctx.http.get).mockResolvedValue([REST_ROW])

    const page = await new DiscussionsBackend(ctx).getComments({ first: 10 })

    expect(page.comments.map((c) => c.id)).toEqual([1])
    expect(vi.mocked(ctx.http.get)).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(ctx.http.get).mock.calls[0]![0])).toContain('/comments')
  })

  it('resolves a thread by number over the proxy without a REST lookup', async () => {
    const proxy = proxyReadMock({
      repository: {
        discussion: {
          id: 'D_proxy',
          number: 7,
          title: 'Proxy thread',
          url: 'https://github.com/gitalk/gitalk/discussions/7',
          locked: false
        }
      }
    })
    const ctx = makeCtx({ proxyRead: proxy.read, getThread: () => null })
    const backend = new DiscussionsBackend(ctx)

    const thread = await backend.resolveThread({ number: 7, term: 'ignored' })

    expect(thread).toMatchObject({ number: 7, nodeId: 'D_proxy', title: 'Proxy thread' })
    // Deliberately unset: a later REST fallback must derive its own last page
    // from `Link`, not from a GraphQL count that excludes replies.
    expect(thread?.commentCount).toBeUndefined()
    expect(vi.mocked(ctx.http.get)).not.toHaveBeenCalled()
    expect(proxy.calls[0]!.body.query).toBe(DISCUSSION_THREAD_QUERY)
  })

  it('scans the discussion list over the proxy for a title match', async () => {
    const proxy = proxyReadMock({
      repository: {
        discussions: {
          nodes: [
            { id: 'D_1', number: 1, title: 'unrelated', url: 'u1', locked: false },
            { id: 'D_2', number: 2, title: '/page', url: 'u2', locked: false }
          ],
          pageInfo: { hasNextPage: false, endCursor: 'e' }
        }
      }
    })
    const ctx = makeCtx({ proxyRead: proxy.read, getThread: () => null })

    const thread = await new DiscussionsBackend(ctx).resolveThread({ term: '/page' })

    expect(thread?.number).toBe(2)
    expect(vi.mocked(ctx.http.get)).not.toHaveBeenCalled()
    expect(proxy.calls[0]!.body.query).toBe(DISCUSSION_LIST_QUERY)
  })
})

describe('IssuesBackend anonymous proxy reads', () => {
  it('reads issue comments through the proxy', async () => {
    const proxy = proxyReadMock({
      repository: {
        issue: {
          comments: {
            totalCount: 1,
            pageInfo: { hasNextPage: false, hasPreviousPage: false },
            nodes: [
              node({
                id: 'IC_1',
                databaseId: 21,
                bodyHTML: '<p>issue comment</p>',
                reactionGroups: [{ content: 'ROCKET', reactors: { totalCount: 1 } }]
              })
            ]
          }
        }
      }
    })
    const issueThread: ThreadInfo = { ...THREAD, kind: 'issues', nodeId: 'I_1' }
    const ctx = makeCtx({ proxyRead: proxy.read, getThread: () => issueThread })
    const backend = new IssuesBackend(ctx, { labels: ['Gitalk'], title: 't', body: 'b' })

    const page = await backend.getComments({ first: 10 })

    expect(page.comments).toHaveLength(1)
    expect(page.comments[0]!.replies).toEqual([])
    expect(page.comments[0]!.reactions.counts).toEqual({ ROCKET: 1 })
    expect(vi.mocked(ctx.http.get)).not.toHaveBeenCalled()
    expect(proxy.calls[0]!.body.query).toBe(ISSUE_COMMENTS_QUERY)
  })

  it('falls back to label REST lookup when the proxy declines', async () => {
    const ctx = makeCtx({
      proxyRead: proxyReadMock(null).read,
      getThread: () => null
    })
    vi.mocked(ctx.http.get).mockResolvedValue([
      { number: 1, node_id: 'I_1', title: '/page', html_url: 'u', locked: false, labels: [] }
    ])

    const thread = await new IssuesBackend(ctx, {
      labels: ['Gitalk'],
      title: 't',
      body: 'b'
    }).resolveThread({ term: '/page' })

    expect(thread?.number).toBe(1)
    expect(String(vi.mocked(ctx.http.get).mock.calls[0]![0])).toContain('labels=Gitalk')
  })
})
