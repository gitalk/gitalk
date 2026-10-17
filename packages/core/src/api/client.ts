export const GITHUB_API = 'https://api.github.com'
export const API_VERSION = '2026-03-10'

/**
 * Opt-in for GitHub's next-generation global node IDs.
 *
 * Without it GitHub replies with the legacy format (`MDEwOkRpc2N1c3Npb24…`,
 * which decodes to `010:Discussion3288936`) and GraphQL appends a DEPRECATION
 * warning telling you to switch. REST honours the header too — verified
 * against api.github.com on 2026-10-17: a discussion's `node_id` comes back as
 * `D_kwDOFPp0Jc4AM14u` with the header and as the legacy base64 string
 * without it. This matters because every mutation below is sent the id that
 * the REST read produced.
 *
 * Docs: https://docs.github.com/en/graphql/guides/migrating-graphql-global-node-ids
 */
export const NEXT_GLOBAL_ID_HEADER = 'X-Github-Next-Global-ID'

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
  cache?: RequestCache
}

/**
 * The page numbers GitHub reports in its `Link` header, already parsed.
 *
 * `last` is the one that matters for display: GitHub's comment endpoints
 * ignore `direction`, so the newest-first list is built by reading the *last*
 * page of the ascending feed. `Link` is the only way to learn that page
 * without another request.
 */
export interface PageLinks {
  first: number | null
  prev: number | null
  next: number | null
  last: number | null
}

const NO_LINKS: PageLinks = { first: null, prev: null, next: null, last: null }

/**
 * Parse a `Link: <url?page=2>; rel="next", <url?page=9>; rel="last"` header.
 *
 * Returns all-null for a missing/empty header, which is exactly what a
 * single-page result (no `Link` at all) looks like.
 */
export function parsePageLinks(header: string | null): PageLinks {
  if (!header) return { ...NO_LINKS }

  const links: PageLinks = { ...NO_LINKS }
  for (const part of header.split(',')) {
    const rel = part.match(/rel\s*=\s*"?([a-z]+)"?/i)?.[1]?.toLowerCase()
    const page = part.match(/[?&]page=(\d+)/)?.[1]
    if (!rel || !page) continue
    if (rel === 'first' || rel === 'prev' || rel === 'next' || rel === 'last') {
      links[rel] = Number(page)
    }
  }
  return links
}

/**
 * Thin fetch wrapper over the GitHub REST API.
 *
 * Anonymous requests are legitimate here: REST discussions/issue reads are
 * CORS-enabled (`access-control-allow-origin: *`) while a direct GraphQL call
 * is NOT available anonymously (`x-ratelimit-limit: 0`). GraphQL reads can
 * still happen anonymously through a configured token proxy; that path is
 * `BackendContext.proxyRead`, not this REST client. See docs/tech.md §2.1.
 */
export class HttpClient {
  constructor(
    private readonly getToken: () => string | null = () => null,
    private readonly baseUrl: string = GITHUB_API
  ) {}

  async request<T>(path: string, init: RequestInitLike = {}): Promise<T> {
    return (await this.requestWithLinks<T>(path, init)).data
  }

  /**
   * `request`, plus the parsed pagination `Link` header.
   *
   * Separated rather than merged into `request` so the common case keeps its
   * old signature: callers that only want the body should not have to unpack
   * a tuple.
   */
  async requestWithLinks<T>(
    path: string,
    init: RequestInitLike = {}
  ): Promise<{ data: T; links: PageLinks }> {
    const headers: Record<string, string> = {
      Accept: HTML_MEDIA_TYPE,
      'X-GitHub-Api-Version': API_VERSION,
      [NEXT_GLOBAL_ID_HEADER]: '1',
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

    return {
      data: (await response.json()) as T,
      links: parsePageLinks(response.headers.get('Link'))
    }
  }

  get<T>(path: string, init?: RequestInitLike) {
    return this.request<T>(path, { ...init, method: 'GET' })
  }

  getWithLinks<T>(path: string, init?: RequestInitLike) {
    return this.requestWithLinks<T>(path, { ...init, method: 'GET' })
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
