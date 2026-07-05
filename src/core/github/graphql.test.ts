import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCommentsPage, removeCommentReaction } from './graphql'

const mockFetch = vi.fn()

const defaultAuthor = { avatarUrl: 'default-avatar', login: 'default-login', url: 'default-url' }

const graphqlResponse = (comments: unknown) => ({
  ok: true,
  status: 200,
  json: async () => ({
    data: { repository: { issue: { comments } } },
  }),
})

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getCommentsPage', () => {
  it('queries backwards for last direction and maps deleted author to defaultAuthor', async () => {
    mockFetch.mockResolvedValue(
      graphqlResponse({
        totalCount: 1,
        pageInfo: { hasPreviousPage: true, startCursor: 'cursor-start' },
        nodes: [
          {
            id: 'gid-1',
            databaseId: 1,
            author: null,
            bodyHTML: '<p>new</p>',
            body: 'new',
            createdAt: '2020-01-01T00:00:00Z',
            reactions: {
              totalCount: 0,
              viewerHasReacted: false,
              pageInfo: { hasNextPage: false },
              nodes: [],
            },
          },
        ],
      })
    )

    const page = await getCommentsPage({
      owner: 'gitalk',
      repo: 'repo',
      issueNumber: 7,
      perPage: 10,
      pagerDirection: 'last',
      cursor: null,
      token: 'token-last',
      defaultAuthor,
    })

    const [url, init] = mockFetch.mock.calls[0]
    const payload = JSON.parse(init.body)
    expect(url).toBe('https://api.github.com/graphql')
    expect(init.headers.Authorization).toBe('bearer token-last')
    expect(payload.query).toContain('comments(last: $pageSize, before: $cursor)')
    expect(payload.variables.cursor).toBeUndefined()

    expect(page.items).toHaveLength(1)
    expect(page.items[0].id).toBe(1)
    expect(page.items[0].gId).toBe('gid-1')
    expect(page.items[0].user?.login).toBe('default-login')
    expect(page.items[0].html_url).toBe('https://github.com/gitalk/repo/issues/7#issuecomment-1')
    expect(page.cursor).toBe('cursor-start')
    expect(page.isLoadOver).toBe(false)
    expect(page.totalCount).toBe(1)
  })

  it('queries forwards for first direction and reports load-over', async () => {
    mockFetch.mockResolvedValue(
      graphqlResponse({
        totalCount: 1,
        pageInfo: { hasNextPage: false, endCursor: 'cursor-end' },
        nodes: [
          {
            id: 'gid-2',
            databaseId: 2,
            author: { avatarUrl: 'author-avatar', login: 'author-login', url: 'author-url' },
            bodyHTML: '<p>first</p>',
            body: 'first',
            createdAt: '2020-01-02T00:00:00Z',
            reactions: {
              totalCount: 1,
              viewerHasReacted: true,
              pageInfo: { hasNextPage: false },
              nodes: [],
            },
          },
        ],
      })
    )

    const page = await getCommentsPage({
      owner: 'gitalk',
      repo: 'repo',
      issueNumber: 8,
      perPage: 10,
      pagerDirection: 'first',
      cursor: 'cursor-current',
      token: 'token-first',
      defaultAuthor,
    })

    const payload = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(payload.query).toContain('comments(first: $pageSize, after: $cursor)')
    expect(payload.variables.cursor).toBe('cursor-current')

    expect(page.items[0].user?.login).toBe('author-login')
    expect(page.cursor).toBe('cursor-end')
    expect(page.isLoadOver).toBe(true)
  })

  it('throws when graphql response has no data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ errors: [{ message: 'Bad credentials' }] }),
    })

    await expect(
      getCommentsPage({
        owner: 'o',
        repo: 'r',
        issueNumber: 1,
        perPage: 10,
        pagerDirection: 'last',
        cursor: null,
        token: 'bad',
        defaultAuthor,
      })
    ).rejects.toThrow('GraphQL request failed')
  })
})

describe('removeCommentReaction', () => {
  it('posts removeReaction mutation with bearer token', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { removeReaction: { reaction: { content: 'HEART' } } } }),
    })

    await removeCommentReaction('gid-9', 'tok')

    const [, init] = mockFetch.mock.calls[0]
    expect(init.headers.Authorization).toBe('bearer tok')
    expect(init.body).toContain('removeReaction')
    expect(init.body).toContain('gid-9')
  })
})
