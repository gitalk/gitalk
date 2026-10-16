export const GITHUB_API = 'https://api.github.com'
export const API_VERSION = '2026-03-10'

/**
 * `full+json` makes GitHub return the *server-rendered* `body_html` /
 * `body_text` fields over plain REST, which is how we avoid bundling a
 * markdown parser. Verified against both Discussions and Issues endpoints.
 */
export const HTML_MEDIA_TYPE = 'application/vnd.github.v3.full+json'
export const JSON_MEDIA_TYPE = 'application/vnd.github+json'

export const GT_ACCESS_TOKEN = 'GT_ACCESS_TOKEN'
export const GT_COMMENT = 'GT_COMMENT'

export class GitalkError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly rateLimited = false
  ) {
    super(message)
    this.name = 'GitalkError'
  }
}

export class RateLimitError extends GitalkError {
  constructor(message = 'GitHub API rate limit exceeded') {
    super(message, 429, true)
    this.name = 'RateLimitError'
  }
}

interface RequestInitLike {
  method?: string
  headers?: Record<string, string>
  body?: string
  signal?: AbortSignal
}

/**
 * Thin fetch wrapper over the GitHub REST API.
 *
 * Anonymous requests are legitimate here: REST discussions/issue reads are
 * CORS-enabled (`access-control-allow-origin: *`) while GraphQL is NOT
 * available anonymously at all (`x-ratelimit-limit: 0`). See docs/tech.md §2.1.
 */
export class HttpClient {
  constructor(
    private readonly getToken: () => string | null = () => null,
    private readonly baseUrl: string = GITHUB_API
  ) {}

  async request<T>(path: string, init: RequestInitLike = {}): Promise<T> {
    const headers: Record<string, string> = {
      Accept: HTML_MEDIA_TYPE,
      'X-GitHub-Api-Version': API_VERSION,
      ...init.headers
    }

    const token = this.getToken()
    if (token) headers.Authorization = `Bearer ${token}`

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers
      })
    } catch (err) {
      throw new GitalkError(`Network error: ${(err as Error).message}`)
    }

    if (response.status === 429) throw new RateLimitError()
    if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
      throw new RateLimitError()
    }

    if (!response.ok) {
      throw new GitalkError(await extractMessage(response), response.status)
    }

    return (await response.json()) as T
  }

  get<T>(path: string, init?: RequestInitLike) {
    return this.request<T>(path, { ...init, method: 'GET' })
  }

  post<T>(path: string, body: unknown, init?: RequestInitLike) {
    return this.request<T>(path, {
      ...init,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      body: JSON.stringify(body)
    })
  }
}

export async function extractMessage(response: Response): Promise<string> {
  let detail = ''
  try {
    const data = (await response.json()) as {
      message?: string
      errors?: Array<{ message: string }>
    }
    if (data.message) detail += ` ${data.message}.`
    if (data.errors?.length) detail += ` ${data.errors.map((e) => e.message).join(', ')}`
  } catch {
    // non-JSON error body
  }
  return `Error ${response.status}:${detail || ' request failed'}`
}

/**
 * Render markdown server-side. Works anonymously (verified), so the preview
 * pane costs us zero bundle bytes. See docs/tech.md §4.1.
 */
export async function renderMarkdown(text: string, token?: string | null): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(`${GITHUB_API}/markdown`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text, mode: 'gfm' })
  })

  if (!response.ok) throw new GitalkError(await extractMessage(response), response.status)
  return await response.text()
}
