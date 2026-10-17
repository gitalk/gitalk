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
  const get = vi.fn()
  return {
    // `getWithLinks` delegates to the same `get` spy so a test that stubs the
    // body (`mockResolvedValue`) keeps working; tests that care about the
    // pagination `Link` header stub `getWithLinks` directly.
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
  locked: false,
  // Reported by the REST discussion object; the newest-first read uses it to
  // find the last offset page without an extra request.
  commentCount: 3
}

/** The `page` query parameter of every request a mocked transport saw. */
function pageParams(mock: { mock: { calls: unknown[][] } }): Array<string | null> {
  return mock.mock.calls.map((call) => new URL(String(call[0]), 'http://x').searchParams.get('page'))
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

/** Mirrors the live REST shape: replies are interleaved with top-level, ascending. */
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
    reactions: { total_count: 0, '+1': 0, heart: 0 }
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
    reactions: { total_count: 4, '+1': 1, laugh: 0, heart: 2, rocket: 1 }
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
    reactions: { total_count: 0, '+1': 0, heart: 0 }
  }
]

describe('DiscussionsBackend.getComments', () => {
  it('regroups REST replies under their parent instead of listing them flat', async () => {
    const ctx = makeCtx()
    vi.mocked(ctx.http.get).mockResolvedValue(REST_COMMENTS)

    const backend = new DiscussionsBackend(ctx)
    const page = await backend.getComments({ first: 100 })

    expect(page.comments).toHaveLength(2)
    // Newest top-level first (913250 is a month after 523955), regardless of
    // the ascending payload the endpoint actually returned.
    const [newest, oldest] = page.comments
    expect(newest!.id).toBe(913250)
    expect(oldest!.id).toBe(523955)
    expect(oldest!.replies).toHaveLength(1)
    expect(oldest!.replies[0]!.id).toBe(3485634)

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

  it('keeps every per-type reaction count and an aggregate that matches them', async () => {
    // The picker shows all eight types, so the whole REST breakdown has to
    // survive normalisation — an older version of this code threw away
    // everything except `heart`.
    const ctx = makeCtx()
    vi.mocked(ctx.http.get).mockResolvedValue(REST_COMMENTS)
    const backend = new DiscussionsBackend(ctx)
    const page = await backend.getComments({ first: 100 })

    const reacted = page.comments.find((c) => c.id === 913250)!
    expect(reacted.reactions.counts).toEqual({ THUMBS_UP: 1, HEART: 2, ROCKET: 1 })
    expect(reacted.reactions.totalCount).toBe(4)
    // No viewer on an anonymous read, so nothing may claim the visitor reacted.
    expect(reacted.reactions.viewerReactions).toEqual({})
    expect(reacted.reactions.viewerHasReacted).toBe(false)
  })

  it('shows the newest comment first even though the endpoint returns ascending rows', async () => {
    // Regression for the reported "comments are in time order (oldest first)"
    // bug. Root cause: GitHub's REST comment endpoints ignore `direction`
    // (measured: asc, desc and omitting it return identical ascending data),
    // so the old code's `direction=desc` was a no-op and the payload was
    // rendered in the order it arrived.
    const ctx = makeCtx()
    vi.mocked(ctx.http.get).mockResolvedValue(REST_COMMENTS)
    const backend = new DiscussionsBackend(ctx)
    const page = await backend.getComments({ first: 100, direction: 'last' })

    const times = page.comments.map((c) => Date.parse(c.createdAt))
    expect(times).toEqual([...times].sort((a, b) => b - a))
    expect(page.comments[0]!.id).toBe(913250)

    // ...and the opposite direction is still available (GitalkOptions.sortDirection).
    const ascending = await backend.getComments({ first: 100, direction: 'first' })
    expect(ascending.comments.map((c) => c.id)).toEqual([523955, 913250])
  })

  it('keeps replies in reading order under their parent whichever way the thread is sorted', async () => {
    const ctx = makeCtx()
    vi.mocked(ctx.http.get).mockResolvedValue([
      ...REST_COMMENTS,
      { ...REST_COMMENTS[2]!, id: 4000000, created_at: '2022-03-01T00:00:00Z' }
    ])
    const backend = new DiscussionsBackend(ctx)
    const page = await backend.getComments({ first: 100, direction: 'last' })
    const parent = page.comments.find((c) => c.id === 523955)!
    expect(parent.replies.map((r) => r.id)).toEqual([3485634, 4000000])
  })

  it('reads the newest window from the last offset page, because direction is ignored', async () => {
    const getWithLinks = vi.fn(async (path: string) => ({
      // Page 3 of 3 at per_page=10 holds the three newest of thirty comments.
      data: [
        { ...REST_COMMENTS[1]!, id: 30, created_at: '2021-09-01T00:00:00Z' },
        { ...REST_COMMENTS[1]!, id: 29, created_at: '2021-08-01T00:00:00Z' },
        { ...REST_COMMENTS[1]!, id: 28, created_at: '2021-07-01T00:00:00Z' }
      ],
      links: { first: 1, prev: 2, next: null, last: 3 }
    }))
    const backend = new DiscussionsBackend(
      makeCtx({
        getThread: () => ({ ...THREAD, commentCount: 30 }),
        http: { getWithLinks } as unknown as HttpClient
      })
    )

    const page = await backend.getComments({ first: 10, direction: 'last', page: 1 })

    expect(getWithLinks.mock.calls[0]![0]).toContain('page=3')
    expect(page.comments.map((c) => c.id)).toEqual([30, 29, 28])
    expect(page.hasNextPage).toBe(true)

    // Logical page 2 walks one block further back in time, not forward.
    await backend.getComments({ first: 10, direction: 'last', page: 2 })
    expect(getWithLinks.mock.calls[1]![0]).toContain('page=2')
    expect(getWithLinks.mock.calls[1]![0]).not.toContain('direction=')
  })

  it('re-probes the end after a write instead of trusting the stale page cache', async () => {
    // A thread with two pages of ten. The second read is the one that follows
    // posting a comment: the cached page number and the thread's comment count
    // both predate it, so answering from either would show the *previous* last
    // page and make the newest comments vanish.
    const page = (ids: number[], last: number, next: number | null = null, prev: number | null = null) => ({
      data: ids.map((id) => ({ ...REST_COMMENTS[1]!, id })),
      links: { first: 1, prev, next, last }
    })
    const getWithLinks = vi
      .fn()
      .mockResolvedValueOnce(page([20, 19, 18], 2, null, 1)) // page 2, before the post
      .mockResolvedValueOnce(page([10, 9, 8], 3, 2, null)) // probe: page 1 now says last=3
      .mockResolvedValueOnce(page([33, 32, 31], 3, null, 2)) // the real newest page

    const backend = new DiscussionsBackend(
      makeCtx({
        getThread: () => ({ ...THREAD, commentCount: 20 }),
        http: { getWithLinks } as unknown as HttpClient
      })
    )

    const before = await backend.getComments({ first: 10, direction: 'last' })
    expect(before.comments.map((c) => c.id)).toEqual([20, 19, 18])

    const after = await backend.getComments({ first: 10, direction: 'last', fresh: true })
    expect(pageParams(getWithLinks)).toEqual(['2', '1', '3'])
    expect(getWithLinks.mock.calls[1]![1]).toMatchObject({ cache: 'reload' })
    expect(after.comments.map((c) => c.id)).toEqual([33, 32, 31])
    expect(after.hasNextPage).toBe(true)
  })

  it('steps back one page when the newest window is empty', async () => {
    // Someone deleted comments between the thread lookup and this read, so the
    // page the count pointed at no longer exists.
    const getWithLinks = vi
      .fn()
      .mockResolvedValueOnce({ data: [], links: { first: 1, prev: 1, next: null, last: 2 } })
      .mockResolvedValueOnce({
        data: [{ ...REST_COMMENTS[1]!, id: 77 }],
        links: { first: 1, prev: null, next: 2, last: 2 }
      })
    const backend = new DiscussionsBackend(
      makeCtx({
        getThread: () => ({ ...THREAD, commentCount: 21 }),
        http: { getWithLinks } as unknown as HttpClient
      })
    )

    const result = await backend.getComments({ first: 10, direction: 'last' })
    expect(pageParams(getWithLinks)).toEqual(['3', '2'])
    expect(result.comments.map((c) => c.id)).toEqual([77])
  })

  it('probes the Link header once when the thread reports no comment count', async () => {
    const getWithLinks = vi
      .fn()
      .mockResolvedValueOnce({
        data: [REST_COMMENTS[0]!],
        links: { first: 1, prev: null, next: 2, last: 2 }
      })
      .mockResolvedValueOnce({
        data: [{ ...REST_COMMENTS[1]!, id: 99 }],
        links: { first: 1, prev: 1, next: null, last: 2 }
      })
    const backend = new DiscussionsBackend(
      makeCtx({
        getThread: () => ({ ...THREAD, commentCount: undefined }),
        http: { getWithLinks } as unknown as HttpClient
      })
    )

    const page = await backend.getComments({ first: 1, direction: 'last' })

    expect(getWithLinks.mock.calls[0]![0]).toContain('page=1')
    expect(getWithLinks.mock.calls[1]![0]).toContain('page=2')
    expect(page.comments.map((c) => c.id)).toEqual([99])
    expect(page.hasNextPage).toBe(true)
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

describe('reaction state hydration', () => {
  it('answers per-type counts and viewer flags for a batch of node ids', async () => {
    const { fn, calls } = graphqlMock({
      data: {
        nodes: [
          {
            id: 'n900',
            reactionGroups: [
              { content: 'HEART', viewerHasReacted: true, reactors: { totalCount: 3 } },
              { content: 'THUMBS_UP', viewerHasReacted: false, reactors: { totalCount: 0 } },
              { content: 'ROCKET', viewerHasReacted: false, reactors: { totalCount: 2 } }
            ]
          },
          { id: 'n901' }
        ]
      }
    })
    const backend = new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }))

    const states = await backend.getReactionStates(['n900', 'n901'])

    expect(calls[0]!.query).toContain('nodes(ids: $ids)')
    expect(calls[0]!.query).toContain('... on Reactable')
    expect(calls[0]!.query).toContain('reactors(first: 0) { totalCount }')
    expect(calls[0]!.variables).toEqual({ ids: ['n900', 'n901'] })

    // Zero-count types are dropped: they are not chips.
    expect(states.get('n900')).toEqual({
      counts: { HEART: 3, ROCKET: 2 },
      viewerReactions: { HEART: true }
    })
    // A node that does not implement Reactable simply reports nothing.
    expect(states.get('n901')).toEqual({ counts: {}, viewerReactions: {} })
  })

  it('does not spend an anonymous request and caps the batch at 100 ids', async () => {
    const anonymous = graphqlMock()
    const anon = new DiscussionsBackend(makeCtx({ graphql: anonymous.fn }))
    await expect(anon.getReactionStates(['n1'])).resolves.toHaveProperty('size', 0)
    expect(anonymous.calls).toHaveLength(0)

    const { fn, calls } = graphqlMock({ data: { nodes: [] } })
    const backend = new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }))
    const many = Array.from({ length: 150 }, (_, i) => `n${i}`)
    await backend.getReactionStates(many)
    expect((calls[0]!.variables.ids as string[]).length).toBe(100)
  })

  it('works for the Issues backend too, where reactions also exist', async () => {
    const { fn, calls } = graphqlMock({
      data: {
        nodes: [
          {
            id: 'IC_1',
            reactionGroups: [{ content: 'EYES', viewerHasReacted: true, reactors: { totalCount: 1 } }]
          }
        ]
      }
    })
    const backend = new IssuesBackend(
      makeCtx({
        getToken: () => 'tok',
        graphql: fn,
        getThread: () => ({ ...THREAD, kind: 'issues' })
      }),
      { labels: ['Gitalk'], title: 't', body: 'b' }
    )

    const states = await backend.getReactionStates(['IC_1'])
    expect(states.get('IC_1')?.viewerReactions).toEqual({ EYES: true })
    expect(calls[0]!.query).toContain('gitalkReactionStates')
  })
})

describe('DiscussionsBackend upvotes', () => {
  it('reads upvoteCount / viewerHasUpvoted from the Discussion node', async () => {
    const { fn, calls } = graphqlMock({ data: { node: { upvoteCount: 7, viewerHasUpvoted: true } } })
    const backend = new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }))

    await expect(backend.getUpvote()).resolves.toEqual({ count: 7, viewerHasUpvoted: true })
    expect(calls[0]!.query).toContain('upvoteCount')
    expect(calls[0]!.query).toContain('viewerHasUpvoted')
    expect(calls[0]!.query).toContain('... on Discussion')
    expect(calls[0]!.variables).toEqual({ id: 'D_kwDO' })
  })

  it('does not spend an anonymous GraphQL request, which would only 403', async () => {
    const { fn, calls } = graphqlMock()
    const backend = new DiscussionsBackend(makeCtx({ graphql: fn }))
    await expect(backend.getUpvote()).resolves.toBeNull()
    expect(calls).toHaveLength(0)
  })

  it('sends addUpvote / removeUpvote on the discussion node id', async () => {
    const { fn, calls } = graphqlMock({ data: {} }, { data: {} })
    const backend = new DiscussionsBackend(makeCtx({ getToken: () => 'tok', graphql: fn }))

    await backend.setUpvote(true)
    expect(calls[0]!.query).toContain('addUpvote')
    expect(calls[0]!.variables).toEqual({ subjectId: 'D_kwDO' })

    await backend.setUpvote(false)
    expect(calls[1]!.query).toContain('removeUpvote')
  })
})

describe('IssuesBackend degradation', () => {
  const ISSUE_THREAD: ThreadInfo = { ...THREAD, kind: 'issues', nodeId: 'I_1' }

  it('declares no upvote support, so the UI never renders the control', () => {
    const backend = new IssuesBackend(makeCtx({ getThread: () => ISSUE_THREAD }), {
      labels: ['Gitalk'],
      title: 't',
      body: 'b'
    })
    expect(backend.supportsUpvote).toBe(false)
  })

  it('answers getUpvote with null and refuses setUpvote with an explanation', async () => {
    const backend = new IssuesBackend(makeCtx({ getThread: () => ISSUE_THREAD }), {
      labels: ['Gitalk'],
      title: 't',
      body: 'b'
    })
    await expect(backend.getUpvote()).resolves.toBeNull()
    await expect(backend.setUpvote(true)).rejects.toThrow(/only available for GitHub Discussions/)
  })

  it('refuses a threaded reply instead of silently posting a top-level comment', async () => {
    const c = makeCtx({ getThread: () => ISSUE_THREAD })
    const backend = new IssuesBackend(c, { labels: ['Gitalk'], title: 't', body: 'b' })
    await expect(backend.addComment('hi', 12)).rejects.toThrow(/no threaded replies/)
    expect(vi.mocked(c.http.post)).not.toHaveBeenCalled()
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

  it('opts into next-generation global node ids on every request', async () => {
    // Without this header GitHub answers with legacy ids (`MDEwOk…`), and the
    // very next GraphQL mutation using them gets a DEPRECATION warning. The
    // header is what makes `node_id` come back as `D_kw…` / `DC_kw…`.
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response('{}', { status: 200 }))
    await new HttpClient(() => null).get('/x')
    const init = vi.mocked(globalThis.fetch).mock.calls[0]![1] as RequestInit
    expect((init.headers as Record<string, string>)['X-Github-Next-Global-ID']).toBe('1')
  })

  it('asks for a network read when fresh is set', async () => {
    const get = vi.fn().mockResolvedValue([])
    const http = {
      get,
      getWithLinks: vi.fn(async (path: string, init?: unknown) => ({
        data: await get(path, init),
        links: { first: null, prev: null, next: null, last: null }
      })),
      post: vi.fn(),
      request: vi.fn()
    }
    const backend = new DiscussionsBackend(makeCtx({ http: http as unknown as HttpClient }))
    const cacheOf = (call: number) => (get.mock.calls[call]?.[1] as { cache?: string } | undefined)?.cache

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
