import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { DiscussionsBackend } from './discussions'
import { IssuesBackend } from './issues'
import type { BackendContext } from './backend'
import { GitalkError, HttpClient } from './client'
import type { ThreadInfo } from '../types'

/**
 * Backend tests run against a stubbed HttpClient so they exercise the real
 * normalisation logic — including the REST/GraphQL reply-shape differences
 * documented in docs/tech.md §2.3 — without touching the network.
 */

function makeCtx(overrides: Partial<BackendContext> = {}): BackendContext {
  return {
    http: { get: vi.fn(), post: vi.fn(), request: vi.fn() } as unknown as HttpClient,
    getToken: () => null,
    owner: 'gitalk',
    repo: 'gitalk',
    getThread: () => THREAD,
    term: () => 'page-id',
    ...overrides
  }
}

const THREAD: ThreadInfo = {
  kind: 'discussions',
  number: 442,
  title: 'demo',
  url: 'https://github.com/gitalk/gitalk/discussions/442',
  nodeId: 'D_kwDO',
  locked: false
}

/** Mirrors the live REST shape: replies are interleaved with top-level. */
const REST_COMMENTS = [
  {
    id: 523955,
    node_id: 'MDE3OkRpc2N1c3Npb25Db21tZW50NTIzOTU1',
    user: { login: 'booxood', avatar_url: 'https://avatars.test/1', html_url: 'https://github.com/booxood' },
    body_html: '<p>配置贴出来看下？</p>',
    created_at: '2021-03-24T10:59:53Z',
    html_url: 'https://github.com/gitalk/gitalk/discussions/442#discussioncomment-523955',
    parent_id: null,
    child_comment_count: 1,
    reactions: { total_count: 0, heart: 0 }
  },
  {
    id: 913250,
    node_id: 'MDE3OkRpc2N1c3Npb25Db21tZW50OTEzMjUw',
    user: { login: 'cnrkuo', avatar_url: 'https://avatars.test/2', html_url: 'https://github.com/cnrkuo' },
    body_html: '<p>second top level</p>',
    created_at: '2021-06-24T05:43:13Z',
    html_url: 'https://github.com/gitalk/gitalk/discussions/442#discussioncomment-913250',
    parent_id: null,
    child_comment_count: 0,
    reactions: { total_count: 3, heart: 2 }
  },
  {
    id: 3485634,
    node_id: 'MDE3OkRpc2N1c3Npb25Db21tZW50MzQ4NTYzNA==',
    user: { login: 'sisyphus1212', avatar_url: 'https://avatars.test/3', html_url: 'https://github.com/sisyphus1212' },
    body_html: '<p>a reply</p>',
    created_at: '2022-02-01T00:00:00Z',
    html_url: 'https://github.com/gitalk/gitalk/discussions/442#discussioncomment-3485634',
    parent_id: 523955,
    child_comment_count: 0,
    reactions: { total_count: 0, heart: 0 }
  }
]

describe('DiscussionsBackend.getComments', () => {
  it('regroups REST replies under their parent instead of listing them flat', async () => {
    const ctx = makeCtx()
    vi.mocked(ctx.http.get).mockResolvedValue(REST_COMMENTS)

    const backend = new DiscussionsBackend(ctx)
    const page = await backend.getComments({ first: 100 })

    expect(page.comments).toHaveLength(2)
    const first = page.comments[0]!
    expect(first.id).toBe(523955)
    expect(first.replies).toHaveLength(1)
    expect(first.replies[0]!.id).toBe(3485634)

    const flat = [...page.comments, ...page.comments.flatMap((c) => c.replies)]
    expect(flat.map((c) => c.id).sort((a, b) => a - b)).toEqual([523955, 913250, 3485634])
  })

  it('keeps the GraphQL node id on every comment so reactions stay possible', async () => {
    const ctx = makeCtx()
    vi.mocked(ctx.http.get).mockResolvedValue(REST_COMMENTS)
    const backend = new DiscussionsBackend(ctx)
    const page = await backend.getComments({ first: 100 })
    for (const c of [...page.comments, ...page.comments.flatMap((x) => x.replies)]) {
      expect(typeof c.nodeId).toBe('string')
      expect(c.nodeId!.length).toBeGreaterThan(0)
    }
  })

  it('prefers the heart count over the aggregate reaction total', async () => {
    const ctx = makeCtx()
    vi.mocked(ctx.http.get).mockResolvedValue(REST_COMMENTS)
    const backend = new DiscussionsBackend(ctx)
    const page = await backend.getComments({ first: 100 })
    expect(page.comments[1]!.reactions.totalCount).toBe(2)
  })

  it('caps per_page at 100 even if the caller asks for more', async () => {
    const ctx = makeCtx()
    vi.mocked(ctx.http.get).mockResolvedValue([])
    const backend = new DiscussionsBackend(ctx)
    await backend.getComments({ first: 500 })
    expect(vi.mocked(ctx.http.get).mock.calls[0]![0]).toContain('per_page=100')
  })
})

describe('DiscussionsBackend auth gating', () => {
  it('refuses comment writes when there is no token, because anonymous GraphQL has a 0 quota', async () => {
    const backend = new DiscussionsBackend(makeCtx())
    await expect(backend.addComment('hi')).rejects.toThrow(/Log in with GitHub/)
  })

  it('refuses reactions without a GraphQL node id', async () => {
    const backend = new DiscussionsBackend(makeCtx())
    await expect(
      backend.toggleReaction({ commentId: 1, nodeId: null, viewerHasReacted: false }, 'HEART')
    ).rejects.toThrow(/no GraphQL node id/)
  })
})

describe('DiscussionsBackend.resolveThread', () => {
  it('fetches directly by number without scanning the list', async () => {
    const ctx = makeCtx({ getThread: () => null })
    vi.mocked(ctx.http.get).mockResolvedValue({
      number: 442,
      node_id: 'D_kwDO',
      title: 'demo',
      html_url: 'https://github.com/gitalk/gitalk/discussions/442',
      locked: false
    })
    const backend = new DiscussionsBackend(ctx)
    const thread = await backend.resolveThread({ number: 442, term: 'demo' })
    expect(thread?.number).toBe(442)
    expect(vi.mocked(ctx.http.get).mock.calls[0]![0]).toContain('/discussions/442')
  })

  it('matches title in the REST listing when no number is given', async () => {
    const ctx = makeCtx({ getThread: () => null })
    vi.mocked(ctx.http.get).mockResolvedValue([{ number: 7, node_id: 'D_7', title: 'page-id', html_url: 'u', locked: false }])
    const backend = new DiscussionsBackend(ctx)
    const thread = await backend.resolveThread({ term: 'page-id' })
    expect(thread?.number).toBe(7)
  })

  it('returns null rather than throwing when the discussion does not exist', async () => {
    const ctx = makeCtx({ getThread: () => null })
    const notFound = new GitalkError('Error 404: Not Found', 404)
    vi.mocked(ctx.http.get).mockRejectedValue(notFound)
    const backend = new DiscussionsBackend(ctx)
    await expect(backend.resolveThread({ number: 999, term: 'x' })).resolves.toBeNull()
  })
})

describe('IssuesBackend', () => {
  const ISSUE_THREAD: ThreadInfo = { ...THREAD, kind: 'issues' }

  function ctx(lenient: Partial<BackendContext> = {}) {
    return makeCtx({ getThread: () => ISSUE_THREAD, ...lenient })
  }

  it('looks up issues by label in a single REST call', async () => {
    const c = ctx()
    vi.mocked(c.http.get).mockResolvedValue([
      { number: 1, node_id: 'I_1', title: 'page-id', html_url: 'u', locked: false, labels: [{ name: 'Gitalk' }] }
    ])
    const backend = new IssuesBackend(c, { labels: ['Gitalk'], title: 't', body: 'b' })
    const thread = await backend.resolveThread({ term: 'page-id' })
    expect(thread?.number).toBe(1)
    expect(vi.mocked(c.http.get).mock.calls[0]![0]).toContain('labels=Gitalk,page-id')
  })

  it('always yields empty replies because issues have no threading', async () => {
    const c = ctx()
    vi.mocked(c.http.get).mockResolvedValue([
      {
        id: 11,
        node_id: 'IC_11',
        user: { login: 'someone', avatar_url: 'a', html_url: 'h' },
        body_html: '<p>hi</p>',
        created_at: '2021-01-01T00:00:00Z',
        html_url: 'https://github.com/x',
        reactions: { heart: 4 }
      }
    ])
    const backend = new IssuesBackend(c, { labels: ['Gitalk'], title: 't', body: 'b' })
    const page = await backend.getComments({ first: 10 })
    expect(page.comments[0]!.replies).toEqual([])
    expect(page.comments[0]!.reactions.totalCount).toBe(4)
  })
})

describe('HttpClient', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('raises a rate-limit error on 429 so the UI can prompt login', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('{}', { status: 429 }))
    const client = new HttpClient(() => null)
    await expect(client.get('/anything')).rejects.toMatchObject({ rateLimited: true, status: 429 })
  })

  it('treats a 403 with zero remaining as a rate limit too', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('{}', { status: 403, headers: { 'X-RateLimit-Remaining': '0' } })
    )
    const client = new HttpClient(() => null)
    await expect(client.get('/anything')).rejects.toMatchObject({ rateLimited: true })
  })

  it('sends the bearer token only when one is available', async () => {
    // A Response body may only be consumed once, so each call needs a fresh one.
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response('{}', { status: 200 }))
    await new HttpClient(() => 'tok').get('/x')
    const init = vi.mocked(globalThis.fetch).mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')

    vi.mocked(globalThis.fetch).mockClear()
    await new HttpClient(() => null).get('/x')
    const anon = vi.mocked(globalThis.fetch).mock.calls[0]![1] as RequestInit
    expect((anon.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('requests the full+json media type so body_html comes back rendered', async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response('{}', { status: 200 }))
    await new HttpClient(() => null).get('/x')
    const init = vi.mocked(globalThis.fetch).mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>).Accept).toContain('full+json')
  })
})
