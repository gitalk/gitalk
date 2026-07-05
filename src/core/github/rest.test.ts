import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { githubRequest, getIssuesByLabels, renderMarkdown } from './rest'
import { GitApiError } from './error'

const mockFetch = vi.fn()

const jsonResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
})

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('githubRequest', () => {
  it('prefixes api.github.com and serializes params', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }))
    await githubRequest('/repos/a/b', { params: { page: 2 } })

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.github.com/repos/a/b?page=2')
    expect(init.method).toBe('GET')
    expect(init.headers.Accept).toBe('application/json')
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('keeps absolute urls untouched', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]))
    await githubRequest('https://api.github.com/repos/a/b/issues/1/comments', {
      params: { page: 1 },
    })
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://api.github.com/repos/a/b/issues/1/comments?page=1'
    )
  })

  it('sends token authorization header', async () => {
    mockFetch.mockResolvedValue(jsonResponse({}))
    await githubRequest('/user', { token: 'abc' })
    expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('token abc')
  })

  it('throws GitApiError with response payload on failure', async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ message: 'Validation Failed', errors: [{ message: 'bad' }] }, 422)
    )
    const err = (await githubRequest('/repos/a/b/issues', { method: 'POST', body: {} }).catch(
      (e) => e
    )) as GitApiError
    expect(err).toBeInstanceOf(GitApiError)
    expect(err.status).toBe(422)
    expect(err.data?.message).toBe('Validation Failed')
  })
})

describe('getIssuesByLabels', () => {
  it('joins labels into a single query param', async () => {
    mockFetch.mockResolvedValue(jsonResponse([]))
    await getIssuesByLabels({ owner: 'o', repo: 'r', labels: ['Gitalk', 'page-id'] })
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('labels=Gitalk%2Cpage-id')
  })
})

describe('renderMarkdown', () => {
  it('returns raw html text', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('not json')
      },
      text: async () => '<p>hi</p>',
    })
    await expect(renderMarkdown('hi')).resolves.toBe('<p>hi</p>')
  })
})
