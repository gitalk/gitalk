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
    graphql: (<T>() => Promise.resolve({} as T)) as BackendContext['graphql'],
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

describe('DiscussionsBackend.createThread', () => {
  /**
   * Shaped exactly like the live `RESOLVE_CREATION_TARGET` response: the
   * repository node id plus the category list (`slug` and `name` both present,
   * because the `category` option matches either).
   */
  const TARGET = {
    repository: {
      id: 'R_kgDO',
      hasDiscussionsEnabled: true,
      discussionCategories: {
        nodes: [
          { id: 'DIC_ann', name: 'Announcements', slug: 'announcements' },
          { id: 'DIC_gen', name: 'General', slug: 'general' }
        ]
      }
    }
  }

  const CREATED = {
    createDiscussion: {
      discussion: {
        id: 'D_kwDO7',
        number: 7,
        title: 'Page title',
        url: 'https://github.com/gitalk/gitalk/discussions/7',
        locked: false
      }
    }
  }

  /** A `ctx.graphql` stub that records every document and its variables. */
  function graphqlMock(...responses: unknown[]) {
    const calls: Array<{ query: string; variables: Record<string, unknown> }> = []
    let index = 0
    const fn = (<T,>(body: { query: string; variables: Record<string, unknown> }) => {
      calls.push({ query: body.query, variables: body.variables })
      return Promise.resolve(responses[Math.min(index++, responses.length - 1)] as T)
    }) as BackendContext['graphql']
    return { fn, calls }
  }

  it('sends the documented createDiscussion mutation and returns a usable thread', async () => {
    const { fn, calls } = graphqlMock({ data: TARGET }, { data: CREATED })
    const ctx = makeCtx({ getToken: () => 'tok', graphql: fn })
    const backend = new DiscussionsBackend(ctx, { category: 'General', title: 'Page title', body: 'body' })

    const thread = await backend.createThread()

    // ThreadInfo must carry both ids or the widget cannot read or write next:
    // `number` for the REST comment list, `nodeId` for comment mutations.
    expect(thread).toEqual({
      kind: 'discussions',
      number: 7,
      title: 'Page title',
      url: 'https://github.com/gitalk/gitalk/discussions/7',
      nodeId: 'D_kwDO7',
      locked: false
    })

    // 1) the repository/category lookup
    expect(calls).toHaveLength(2)
    expect(calls[0]!.query).toContain('discussionCategories(first: 100)')
    expect(calls[0]!.query).toContain('hasDiscussionsEnabled')
    expect(calls[0]!.variables).toEqual({ owner: 'gitalk', name: 'gitalk' })

    // 2) the mutation itself, with exactly the input fields GitHub declares
    const mutation = calls[1]!
    expect(mutation.query).toMatch(/mutation/)
    expect(mutation.query).toContain(
      'createDiscussion(input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body })'
    )
    expect(mutation.query).toContain('discussion {\n      id\n      number\n      title\n      url\n      locked')
    expect(mutation.variables).toEqual({
      repositoryId: 'R_kgDO',
      categoryId: 'DIC_gen',
      title: 'Page title',
      body: 'body'
    })
  })

  it('matches the configured category case-insensitively by slug as well as by name', async () => {
    const bySlug = graphqlMock({ data: TARGET }, { data: CREATED })
    await new DiscussionsBackend(
      makeCtx({ getToken: () => 'tok', graphql: bySlug.fn }),
      { category: 'GENERAL', title: 't', body: 'b' }
    ).createThread()
    expect(bySlug.calls[1]!.variables.categoryId).toBe('DIC_gen')

    const byName = graphqlMock({ data: TARGET }, { data: CREATED })
    await new DiscussionsBackend(
      makeCtx({ getToken: () => 'tok', graphql: byName.fn }),
      { category: 'general', title: 't', body: 'b' }
    ).createThread()
    expect(byName.calls[1]!.variables.categoryId).toBe('DIC_gen')
  })

  it('falls back to the first category the API lists when none is configured', async () => {
    // `CreateDiscussionInput.categoryId` is `ID!`, so a category cannot be
    // omitted; without configuration the first listed one is used.
    const { fn, calls } = graphqlMock({ data: TARGET }, { data: CREATED })
    await new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }), {
      title: 't',
      body: 'b'
    }).createThread()

    expect(calls[1]!.variables.categoryId).toBe('DIC_ann')
  })

  it('refuses to create anything, and never touches the network, without a token', async () => {
    const { fn, calls } = graphqlMock({ data: TARGET })
    const backend = new DiscussionsBackend(makeCtx({ graphql: fn }), { title: 't', body: 'b' })

    await expect(backend.createThread()).rejects.toThrow(/Log in with GitHub/)
    // GraphQL's anonymous quota is zero, so the request would be a guaranteed
    // failure dressed up as a 403.
    expect(calls).toHaveLength(0)
  })

  it('explains that Discussions are disabled instead of reporting a generic failure', async () => {
    const { fn, calls } = graphqlMock({
      data: { repository: { ...TARGET.repository, hasDiscussionsEnabled: false } }
    })
    const backend = new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }), {
      title: 't',
      body: 'b'
    })

    await expect(backend.createThread()).rejects.toThrow(/Discussions are disabled for gitalk\/gitalk/)
    expect(calls).toHaveLength(1)
  })

  it('names the missing category problem when the repository has none', async () => {
    const { fn } = graphqlMock({
      data: {
        repository: {
          ...TARGET.repository,
          discussionCategories: { nodes: [] }
        }
      }
    })
    const backend = new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }), {
      title: 't',
      body: 'b'
    })

    await expect(backend.createThread()).rejects.toThrow(/no categories to post into/)
  })

  it('lists the available categories when the configured one does not exist', async () => {
    const { fn, calls } = graphqlMock({ data: TARGET })
    const backend = new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }), {
      category: 'Q&A',
      title: 't',
      body: 'b'
    })

    await expect(backend.createThread()).rejects.toThrow(
      /No discussion category matching `Q&A`.*General \(`general`\)/
    )
    // The mutation is not attempted with an id that cannot work.
    expect(calls).toHaveLength(1)
  })

  it('distinguishes an unresolvable repository from a permission problem', async () => {
    const { fn } = graphqlMock({ data: { repository: null } })
    const backend = new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }), {
      title: 't',
      body: 'b'
    })

    await expect(backend.createThread()).rejects.toThrow(/could not resolve gitalk\/gitalk/i)
  })

  it('classifies a permission failure on the repository lookup, not at the mutation', async () => {
    const { fn, calls } = graphqlMock({
      errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible by integration' }]
    })
    const backend = new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }), {
      title: 't',
      body: 'b'
    })

    // Without this, a token that cannot even read discussions would surface
    // GitHub's opaque wording instead of the fix.
    await expect(backend.createThread()).rejects.toThrow(/discussions: write/)
    expect(calls).toHaveLength(1)
  })

  it('turns a FORBIDDEN mutation error into the permission fix', async () => {
    const { fn } = graphqlMock(
      { data: TARGET },
      {
        errors: [{ type: 'FORBIDDEN', message: 'Resource not accessible by integration' }]
      }
    )
    const backend = new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }), {
      title: 't',
      body: 'b'
    })

    const failure = await backend
      .createThread()
      .then(() => null)
      .catch((err: unknown) => err)

    expect(failure).toBeInstanceOf(GitalkError)
    const error = failure as GitalkError
    expect(error.message).toMatch(/discussions: write/)
    expect(error.status).toBe(403)
  })

  it('points at the `category` option when GitHub rejects the category', async () => {
    const { fn } = graphqlMock(
      { data: TARGET },
      { errors: [{ type: 'UNPROCESSABLE', message: 'Category is not valid' }] }
    )
    const backend = new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }), {
      title: 't',
      body: 'b'
    })

    await expect(backend.createThread()).rejects.toThrow(/`category` option/)
  })

  it('falls back to GitHub\u2019s own wording for anything it cannot classify', async () => {
    const { fn } = graphqlMock({ data: TARGET }, { errors: [{ message: 'Something exploded' }] })
    const backend = new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }), {
      title: 't',
      body: 'b'
    })

    await expect(backend.createThread()).rejects.toThrow(/Something exploded/)
  })

  it('finds a discussion it created by its configured title on the next page load', async () => {
    // `opts.title` is what createThread posts, while `term` is the page id.
    // Matching only the term would hide the new discussion and auto-create a
    // duplicate on every subsequent view.
    const ctx = makeCtx({
      getThread: () => null,
      graphql: graphqlMock().fn
    })
    vi.mocked(ctx.http.get).mockResolvedValue([
      { number: 7, node_id: 'D_kwDO7', title: 'Page title', html_url: 'u', locked: false }
    ])

    const backend = new DiscussionsBackend(ctx, { title: 'Page title', body: 'b' })
    const thread = await backend.resolveThread({ term: '/posts/hello' })
    expect(thread?.number).toBe(7)
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

  it('asks for a network read when fresh is set', async () => {
    const http = { get: vi.fn().mockResolvedValue([]), post: vi.fn(), request: vi.fn() }
    const backend = new DiscussionsBackend(makeCtx({ http: http as unknown as HttpClient }))
    const cacheOf = (call: number) => (http.get.mock.calls[call]?.[1] as { cache?: string } | undefined)?.cache

    // GitHub serves this endpoint with `cache-control: public, max-age=60`, so a
    // reload right after posting can be answered from the browser's copy and show
    // the thread as it was before the comment. `fresh` is how the caller opts out.
    await backend.getComments({ first: 10, fresh: true })
    expect(cacheOf(0)).toBe('reload')

    // Ordinary reads keep the cache: revalidation is free against the rate limit.
    await backend.getComments({ first: 10 })
    expect(cacheOf(1)).toBeUndefined()
  })

})
