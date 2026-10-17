/**
 * Gitalk token + read proxy (Cloudflare Worker).
 *
 * ## Why this exists
 *
 * `github.com/login/oauth/access_token` sends no `Access-Control-Allow-Origin`
 * header, so a browser cannot complete the OAuth exchange itself. Gitalk 1.x
 * therefore posted the OAuth `client_secret` to a third-party CORS proxy,
 * leaking the secret and every visitor's authorization code.
 *
 * This worker runs on infrastructure the project controls, so:
 *   - the secret never reaches a browser or an unrelated server;
 *   - anonymous comment reads go through a GitHub App installation token,
 *     which raises the limit from 60/hr (per IP, shared behind NAT) to
 *     5,000/hr.
 *
 * ## Endpoints
 *
 *   GET  /                      -> health
 *   GET  /oauth/authorize       -> 302 to GitHub's consent screen
 *   GET  /oauth/callback        -> exchange code, redirect back with session
 *   POST /oauth/token           -> session -> access token
 *   *    /graphql               -> proxied GraphQL using the visitor's token;
 *                                 anonymous callers may run a fixed allowlist
 *                                 of public-repository read queries with the
 *                                 installation token (5,000/hr). Mutations and
 *                                 unknown operations stay 401.
 *
 * ## Deploy
 *
 *   npm i -g wrangler
 *   wrangler secret put GITHUB_APP_ID
 *   wrangler secret put GITHUB_APP_PRIVATE_KEY
 *   wrangler secret put GITHUB_CLIENT_ID
 *   wrangler secret put GITHUB_CLIENT_SECRET
 *   wrangler secret put SESSION_ENCRYPTION_KEY   # 32 random bytes, hex
 *   wrangler secret put GITALK_ALLOWED_ORIGINS   # comma-separated, or *
 *   wrangler deploy
 *
 * @see docs/tech.md §3
 */

import { pemToPkcs8 } from './pkcs8'

export interface Env {
  GITHUB_APP_ID: string
  /** PEM-encoded RSA private key for the GitHub App. */
  GITHUB_APP_PRIVATE_KEY: string
  /** OAuth App (same GitHub App) client id — used for the user consent flow. */
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  /** Hex-encoded 32-byte key used to seal session blobs. */
  SESSION_ENCRYPTION_KEY: string
  /**
   * Comma-separated origin allowlist, or `*`.
   *
   * Doubles as the set of blog origins the OAuth callback may hand the session
   * back to, so leaving it unset keeps the return trip on this proxy's own
   * origin rather than opening it to everyone. `*` widens CORS only — see
   * `safeReturnTo`.
   */
  GITALK_ALLOWED_ORIGINS?: string
  /** Optional: skip installation discovery when the app has one install. */
  GITHUB_INSTALLATION_ID?: string
}

const GITHUB_API = 'https://api.github.com'
const GITHUB_AUTHORIZE = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'

/**
 * GitHub rejects any API request without a `User-Agent`, and it answers with
 * **403**, not 401 — so a missing header reads as an authorization problem.
 *
 * The Workers runtime sends no `User-Agent` of its own, which makes this easy
 * to miss: the same request succeeds from Node or curl, because those clients
 * add one for you. Every GitHub call below must set this explicitly.
 */
const GITHUB_USER_AGENT = 'gitalk-proxy'

/** Installation tokens are valid for an hour; refresh a little early. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000

/** Session lifetime. A month is a safer default than giscus's year. */
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60

/**
 * How long a repository's public/private verdict is reused.
 *
 * The visibility lookup costs one installation-token request. Caching it
 * keeps a comment-heavy page from paying that for every comment page, while
 * the short TTL bounds the window in which a repository that was just made
 * private could still be served from cache.
 */
const REPO_VISIBILITY_TTL_MS = 5 * 60 * 1000

/** Bound each in-isolate cache; a proxy may see many repositories. */
const REPO_CACHE_LIMIT = 500

/** Refuse oversized anonymous bodies before parsing them. */
const ANONYMOUS_BODY_LIMIT = 16 * 1024

/** GraphQL cursors are opaque; this is only a sanity bound. */
const CURSOR_LIMIT = 4096

/**
 * Canonical anonymous-read documents.
 *
 * The operation name is the capability, but the document that actually runs is
 * **this copy**, never the caller's body. Operation-name-only checks are not a
 * security boundary: a caller can name a query `gitalkDiscussionComments` and
 * put arbitrary fields (another repository, `viewer`, a mutation-shaped
 * payload) inside it. Substituting the trusted document removes that class of
 * bypass entirely; the caller only chooses a name and validated variables.
 *
 * Keep in sync with `packages/core/src/api/read-queries.ts`. Drift is safe —
 * the widget sees a shape it does not understand and falls back to REST — but
 * costs the 5,000/hr path.
 */
export const ANONYMOUS_READ_QUERIES = {
  gitalkDiscussion: `
query gitalkDiscussion($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    discussion(number: $number) {
      id
      number
      title
      url
      locked
    }
  }
}`,
  gitalkDiscussionList: `
query gitalkDiscussionList($owner: String!, $repo: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    discussions(first: $first, after: $after, orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes {
        id
        number
        title
        url
        locked
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`,
  gitalkDiscussionComments: `
query gitalkDiscussionComments($owner: String!, $repo: String!, $number: Int!, $first: Int, $last: Int, $after: String, $before: String) {
  repository(owner: $owner, name: $repo) {
    discussion(number: $number) {
      comments(first: $first, last: $last, after: $after, before: $before) {
        totalCount
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        nodes {
          id
          databaseId
          author { login avatarUrl url }
          createdAt
          url
          bodyHTML
          reactionGroups { content viewerHasReacted reactors(first: 0) { totalCount } }
          replies(first: 100) {
            totalCount
            nodes {
              id
              databaseId
              author { login avatarUrl url }
              createdAt
              url
              bodyHTML
              reactionGroups { content viewerHasReacted reactors(first: 0) { totalCount } }
            }
          }
        }
      }
    }
  }
}`,
  gitalkIssue: `
query gitalkIssue($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      id
      number
      title
      url
      locked
    }
  }
}`,
  gitalkIssueByLabel: `
query gitalkIssueByLabel($owner: String!, $repo: String!, $labels: [String!]!) {
  repository(owner: $owner, name: $repo) {
    issues(first: 1, labels: $labels, states: [OPEN, CLOSED]) {
      nodes {
        id
        number
        title
        url
        locked
      }
    }
  }
}`,
  gitalkIssueComments: `
query gitalkIssueComments($owner: String!, $repo: String!, $number: Int!, $first: Int, $last: Int, $after: String, $before: String) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      comments(first: $first, last: $last, after: $after, before: $before) {
        totalCount
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        nodes {
          id
          databaseId
          author { login avatarUrl url }
          createdAt
          url
          bodyHTML
          reactionGroups { content viewerHasReacted reactors(first: 0) { totalCount } }
        }
      }
    }
  }
}`
} as const

type AnonymousReadOperation = keyof typeof ANONYMOUS_READ_QUERIES

interface InstallationToken {
  token: string
  expiresAt: number
}

/** A cached public/private verdict for one repository. */
interface RepoVisibility {
  isPublic: boolean
  expiresAt: number
}

/**
 * In-isolate caches. Workers may evict an isolate at any time, so a miss only
 * costs one extra API request; there is deliberately no KV dependency.
 *
 * The installation token is keyed by App + explicit installation id, which
 * keeps tests and multi-App deployments from sharing the wrong credential.
 */
const installationTokenCache = new Map<string, InstallationToken>()
const repoVisibilityCache = new Map<string, RepoVisibility>()

interface SessionPayload {
  accessToken: string
  issuedAt: number
  /**
   * Only issued when the App has "Expire user authorization tokens" enabled.
   * Without it an expired access token cannot be renewed and the visitor has
   * to sign in again.
   */
  refreshToken?: string
  /** Epoch ms at which `accessToken` stops working. Absent means no expiry. */
  expiresAt?: number
  /** Epoch ms at which `refreshToken` stops working. */
  refreshTokenExpiresAt?: number
}

/** A normalized response from `github.com/login/oauth/access_token`. */
interface TokenSet {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  refreshTokenExpiresAt?: number
}

interface GitHubTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
  error?: string
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers }
  })

export async function handle(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url)
  const origin = request.headers.get('Origin')
  const cors = corsHeaders(origin, env.GITALK_ALLOWED_ORIGINS)

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...cors,
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        // Echo whatever the browser says it wants to send.
        //
        // A fixed list here is a bug generator: every header the client adds
        // later fails the preflight for exactly the requests carrying it, while
        // requests carrying none of them keep working. Authorization,
        // X-GitHub-Api-Version and X-Github-Next-Global-ID each broke a
        // different feature this way. The origin allow list is the real access
        // control; which headers may accompany an allowed origin is not a
        // boundary worth maintaining by hand.
        'Access-Control-Allow-Headers':
          request.headers.get('Access-Control-Request-Headers') ??
          'Accept, Authorization, Content-Type, If-None-Match, X-GitHub-Api-Version, X-Github-Next-Global-ID',
        'Access-Control-Expose-Headers': 'ETag, Cache-Control, Last-Modified, Expires',
        'Access-Control-Max-Age': '86400'
      }
    })
  }

  try {
    switch (url.pathname) {
      case '/':
        return json({ ok: true, service: 'gitalk-proxy' }, { headers: cors })

      case '/oauth/authorize':
        return handleAuthorize(url, env)

      case '/oauth/callback':
        return await handleCallback(url, env, cors)

      case '/oauth/token':
        return await handleTokenExchange(request, env, cors)

      case '/graphql':
        return await handleGraphql(request, env, ctx, cors)

      default:
        return json({ error: 'Not found' }, { status: 404, headers: cors })
    }
  } catch (err) {
    // Never leak internals: the browser only needs to know it failed.
    console.error('proxy error:', err)
    return json({ error: 'Proxy request failed' }, { status: 502, headers: cors })
  }
}

/** 302 to GitHub's consent screen, remembering where to return the user. */
function handleAuthorize(url: URL, env: Env): Response {
  // Validate here as well as in the callback: `state` is opaque to GitHub but
  // anyone can mint one, so the callback cannot be the only gate.
  const returnTo = safeReturnTo(
    url.searchParams.get('return_to'),
    url.origin,
    env.GITALK_ALLOWED_ORIGINS
  )

  const target = new URL(GITHUB_AUTHORIZE)
  target.searchParams.set('client_id', env.GITHUB_CLIENT_ID)
  target.searchParams.set('redirect_uri', `${url.origin}/oauth/callback`)
  // No `scope`: a GitHub App's permissions come from its registration, and
  // GitHub ignores `scope` on the authorize URL. Sending one only misleads.
  target.searchParams.set('state', safeEncode(returnTo))

  return Response.redirect(target.toString(), 302)
}

/**
 * Exchange the authorization code and hand the visitor back to their page with
 * an opaque, encrypted session in the query string.
 *
 * The raw access token is deliberately never placed in the URL: URLs leak into
 * history, referrers and server logs.
 */
async function handleCallback(
  url: URL,
  env: Env,
  cors: Record<string, string>
): Promise<Response> {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  // Defence in depth: `state` round-trips through GitHub but is not signed, so
  // it may have been forged. Re-validate instead of trusting `handleAuthorize`.
  const returnTo = state
    ? safeReturnTo(safeDecode(state), url.origin, env.GITALK_ALLOWED_ORIGINS)
    : '/'
  if (error) return redirectBack(returnTo, { error }, url.origin)
  if (!code) return json({ error: '`code` is required' }, { status: 400, headers: cors })

  const tokens = await exchangeCode(env, code)
  if (!tokens) return redirectBack(returnTo, { error: 'token_exchange_failed' }, url.origin)

  const session = await sealSession(env, toSessionPayload(tokens))
  return redirectBack(returnTo, { gitalk_session: session }, url.origin)
}

/** Swap a session for the raw token. Kept out of the page's URL. */
async function handleTokenExchange(
  request: Request,
  env: Env,
  cors: Record<string, string>
): Promise<Response> {
  let session = ''
  try {
    const body = (await request.json()) as { session?: string }
    session = body.session ?? ''
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400, headers: cors })
  }

  const payload = await openSession(env, session)
  if (!payload) return json({ error: 'Invalid or expired session' }, { status: 401, headers: cors })

  const current = await renewIfExpired(env, payload)
  if (!current) {
    // The visitor has to sign in again; say so rather than handing back a
    // token that GitHub will reject.
    return json({ error: 'Session expired; sign in again' }, { status: 401, headers: cors })
  }

  const body: { access_token: string; expires_in?: number; session?: string } = {
    access_token: current.payload.accessToken
  }

  if (current.renewed) {
    // GitHub rotates the refresh token, so the client must replace the session
    // it holds or the next refresh will fail.
    body.session = await sealSession(env, current.payload)
    if (current.payload.expiresAt) {
      body.expires_in = Math.max(0, Math.round((current.payload.expiresAt - Date.now()) / 1000))
    }
  }

  return json(body, { headers: cors })
}

/**
 * Proxy a GraphQL request.
 *
 * Two very different caller classes share this endpoint:
 *
 *  - **Authenticated** (a visitor token in `Authorization`): forwarded
 *    verbatim, exactly as before. Writes are attributed to the real user, and
 *    that is the only way any mutation can run.
 *  - **Anonymous**: only a small, fixed set of repository-scoped read queries
 *    is allowed. The caller picks an operation name; the proxy substitutes its
 *    own canonical document, checks that `$owner`/`$repo` name a **public**
 *    repository, and executes it with the App installation token (5,000/hr).
 *
 * Why the substitution and the visibility check:
 *
 *  - An operation-name whitelist alone is not a boundary. A caller can name an
 *    arbitrary document `gitalkDiscussionComments` and put another repository,
 *    `viewer`, or a write-shaped selection inside it. Running the canonical
 *    copy means the request only ever describes the data shape we audited.
 *  - An installation token can read every repository the App is installed on,
 *    including private ones. Self-hosters may install the App on a private
 *    repository, so the target's public flag is checked out-of-band before the
 *    token is used. The verdict is cached briefly (see
 *    `isPublicRepository`).
 *
 * A mutation — or any operation not in the allowlist — never reaches GitHub
 * anonymously; it gets 401 without spending a token. Authenticated mutations
 * are untouched.
 */
async function handleGraphql(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  cors: Record<string, string>
): Promise<Response> {
  const body = await request.text()
  const token = bearerFrom(request)

  if (token) {
    // Authenticated: forward the caller's document, including mutations. The
    // installation token is never involved, so there is nothing to allowlist.
    return forwardGraphql(request, body, token, cors)
  }

  const anonymous = await authorizeAnonymousRead(body, env)
  if (!anonymous.ok) {
    return json({ error: anonymous.error }, { status: anonymous.status, headers: cors })
  }

  return forwardGraphql(
    request,
    JSON.stringify({ query: anonymous.query, variables: anonymous.variables }),
    anonymous.token,
    cors
  )
}

/**
 * Decide whether an anonymous request may use the installation token.
 *
 * Order matters: reject malformed/unknown documents *before* acquiring a
 * token, so probes cannot consume installation requests, and check visibility
 * *before* executing anything, so a private repository is never queried.
 */
async function authorizeAnonymousRead(
  body: string,
  env: Env
): Promise<
  | { ok: true; token: string; query: string; variables: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  if (body.length > ANONYMOUS_BODY_LIMIT) {
    return deny(413, 'Request body is too large')
  }

  let payload: { query?: unknown; variables?: unknown }
  try {
    payload = JSON.parse(body) as { query?: unknown; variables?: unknown }
  } catch {
    return deny(400, 'Invalid JSON body')
  }

  if (typeof payload.query !== 'string') return deny(401, '`query` is required')

  const operation = parseOperation(payload.query)
  // Anonymous GraphQL has no HTTP-method escape hatch: a document that is not
  // exactly one `query` operation cannot borrow the installation token, even
  // if it is named like an allowed read. Checked before the variables shape so
  // a mutation is always 401, whatever else its body contains.
  if (!operation || operation.type !== 'query' || !operation.name) {
    return deny(401, 'Anonymous reads require an allowlisted read query')
  }

  const canonical = (ANONYMOUS_READ_QUERIES as Record<string, string | undefined>)[operation.name]
  if (!canonical) {
    return deny(401, 'Anonymous reads require an allowlisted read query')
  }

  if (!isPlainObject(payload.variables)) return deny(400, '`variables` must be an object')

  const owner = payload.variables.owner
  const repo = payload.variables.repo
  if (!isRepoPart(owner) || !isRepoPart(repo)) {
    return deny(400, '`variables.owner` and `variables.repo` must be repository names')
  }
  if (!validReadVariables(operation.name as AnonymousReadOperation, payload.variables)) {
    return deny(400, 'Invalid variables for this read operation')
  }

  const token = await installationToken(env)
  if (!token) return deny(503, 'Anonymous reads are unavailable')

  // The only gate that prevents an installation token from exposing a private
  // repository. A failed lookup is treated as "not public" (fail closed).
  if (!(await isPublicRepository(owner, repo, token))) {
    return deny(403, 'Anonymous reads are only available for public repositories')
  }

  return { ok: true, token, query: canonical, variables: payload.variables }
}

const deny = (status: number, error: string) => ({ ok: false as const, status, error })

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** A GitHub owner/repository path segment. Rejects `/`, `.` and `..`. */
function isRepoPart(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 100 &&
    value !== '.' &&
    value !== '..' &&
    /^[A-Za-z0-9_.-]+$/.test(value)
  )
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2_147_483_647
}

function isPageSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100
}

function isCursor(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= CURSOR_LIMIT
}

/**
 * Validate the variables each canonical document declares.
 *
 * Unknown extra variables are harmless (GraphQL ignores them), but the ones
 * that drive pagination are bounded so a caller cannot ask for a 100k-node
 * connection or a cursor-sized payload.
 */
function validReadVariables(
  operation: AnonymousReadOperation,
  variables: Record<string, unknown>
): boolean {
  switch (operation) {
    case 'gitalkDiscussion':
    case 'gitalkIssue':
      return isPositiveInt(variables.number)

    case 'gitalkDiscussionList':
      return (
        isPageSize(variables.first) &&
        (variables.after == null || isCursor(variables.after))
      )

    case 'gitalkIssueByLabel': {
      const labels = variables.labels
      return (
        Array.isArray(labels) &&
        labels.length > 0 &&
        labels.length <= 10 &&
        labels.every((label) => typeof label === 'string' && label.length > 0 && label.length <= 200)
      )
    }

    case 'gitalkDiscussionComments':
    case 'gitalkIssueComments': {
      if (!isPositiveInt(variables.number)) return false
      const hasFirst = variables.first != null
      const hasLast = variables.last != null
      // Exactly one end of the connection, mirroring what the widget sends.
      if (hasFirst === hasLast) return false
      if (hasFirst && !isPageSize(variables.first)) return false
      if (hasLast && !isPageSize(variables.last)) return false
      if (variables.after != null && !isCursor(variables.after)) return false
      if (variables.before != null && !isCursor(variables.before)) return false
      if (hasFirst && variables.before != null) return false
      if (hasLast && variables.after != null) return false
      return true
    }

    default:
      return false
  }
}

/**
 * Parse the operation type and name out of a GraphQL document.
 *
 * This tokenizes enough of the language to ignore whitespace, commas, comments
 * and string literals, then walks the one allowed top-level shape:
 *
 *   <query|mutation|subscription> <name>? (variables)? directives* selection
 *
 * Trailing tokens are rejected, so multiple operations and fragments cannot
 * hide a second, differently-typed operation. Because the request body is
 * ignored in favour of the canonical document anyway, this parser only has to
 * be strict about *what kind* of operation the caller is asking for; aliases
 * and comments cannot turn a `mutation` into a `query`.
 */
export function parseOperation(
  document: string
): { type: 'query' | 'mutation' | 'subscription'; name: string | null } | null {
  const tokens = tokenizeGraphql(document)
  if (!tokens || !tokens.length) return null

  const first = tokens[0]!
  let type: 'query' | 'mutation' | 'subscription'
  let index = 1
  let name: string | null = null

  if (first === '{') {
    // Anonymous shorthand query. Name stays null, so the allowlist rejects it
    // later — but the type is still `query`, not a bypass.
    type = 'query'
    index = 0
  } else if (first === 'query' || first === 'mutation' || first === 'subscription') {
    type = first
  } else {
    return null
  }

  if (first !== '{') {
    if (isNameToken(tokens[index])) {
      name = tokens[index]!
      index++
    }
    if (tokens[index] === '(') {
      index = skipBalanced(tokens, index, '(', ')')
      if (index < 0) return null
    }
    while (tokens[index] === '@') {
      index++
      if (!isNameToken(tokens[index])) return null
      index++
      if (tokens[index] === '(') {
        index = skipBalanced(tokens, index, '(', ')')
        if (index < 0) return null
      }
    }
  }

  if (tokens[index] !== '{') return null
  index = skipBalanced(tokens, index, '{', '}')
  if (index < 0 || index !== tokens.length) return null

  return { type, name }
}

/** GraphQL names are ASCII; `true`/`false`/`null` are just names here. */
function isNameToken(token: string | undefined): token is string {
  return typeof token === 'string' && /^[_A-Za-z][_0-9A-Za-z]*$/.test(token)
}

/** Token-level view of a document: names and single-character punctuation. */
function tokenizeGraphql(document: string): string[] | null {
  const tokens: string[] = []
  let index = 0

  while (index < document.length) {
    const char = document[index]!

    if (char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === ',' || char === '\ufeff') {
      index++
      continue
    }

    // Comments run to end of line and must not contribute tokens.
    if (char === '#') {
      while (index < document.length && document[index] !== '\n') index++
      continue
    }

    // Strings (including block strings) are opaque; braces inside them are
    // data, not structure.
    if (char === '"') {
      const triple = document.slice(index, index + 3) === '"""'
      index += triple ? 3 : 1
      while (index < document.length) {
        if (triple) {
          if (document.slice(index, index + 3) === '"""') {
            index += 3
            break
          }
          index++
        } else {
          if (document[index] === '\\') {
            index += 2
            continue
          }
          if (document[index] === '"') {
            index++
            break
          }
          index++
        }
      }
      if (index > document.length) return null
      tokens.push('STRING')
      continue
    }

    if (/[_A-Za-z]/.test(char)) {
      const start = index
      while (index < document.length && /[_0-9A-Za-z]/.test(document[index]!)) index++
      tokens.push(document.slice(start, index))
      continue
    }

    if (/[0-9]/.test(char)) {
      while (index < document.length && /[0-9.eE+-]/.test(document[index]!)) index++
      tokens.push('NUMBER')
      continue
    }

    if (document.slice(index, index + 3) === '...') {
      tokens.push('...')
      index += 3
      continue
    }

    // Punctuation the structural parser cares about, plus the rest as single
    // tokens (they do not affect the operation boundary).
    tokens.push(char)
    index++
  }

  return tokens
}

/**
 * Return the index just past the matching close token, or -1 when unbalanced.
 * Only parentheses/braces are tracked; brackets and strings cannot contain a
 * stray `{`/`}` that matters here because strings became opaque tokens.
 */
function skipBalanced(tokens: string[], start: number, open: string, close: string): number {
  let depth = 0
  for (let index = start; index < tokens.length; index++) {
    if (tokens[index] === open) depth++
    else if (tokens[index] === close) {
      depth--
      if (depth === 0) return index + 1
    }
  }
  return -1
}

/**
 * Forward one GraphQL request, preserving the cache-related response headers.
 *
 * `cache-control` / `etag` are copied rather than dropped: browser caching is
 * how anonymous readers spend fewer requests, and silently rewriting them
 * would make every page view pay the read again. `If-None-Match` is forwarded
 * so GitHub can answer 304 itself.
 */
async function forwardGraphql(
  request: Request,
  body: string,
  token: string,
  cors: Record<string, string>
): Promise<Response> {
  const nextGlobalId = request.headers.get('X-Github-Next-Global-ID')
  const ifNoneMatch = request.headers.get('If-None-Match')

  const upstream = await fetch(`${GITHUB_API}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      ...(nextGlobalId ? { 'X-Github-Next-Global-ID': nextGlobalId } : {}),
      ...(ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {}),
      'User-Agent': GITHUB_USER_AGENT
    },
    body
  })

  const headers = new Headers(cors)
  headers.set('Content-Type', 'application/json')
  headers.set('Access-Control-Expose-Headers', 'ETag, Cache-Control, Last-Modified, Expires')
  for (const name of ['ETag', 'Cache-Control', 'Last-Modified', 'Expires'] as const) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }

  // Merge rather than replace `Vary`: GitHub may mark a response as varying on
  // Authorization (important for authenticated calls), while our CORS layer
  // needs Origin. Dropping either one lets a shared cache mix responses.
  const upstreamVary = upstream.headers.get('Vary')
  if (upstreamVary) {
    const merged = new Set(['Origin', ...upstreamVary.split(',').map((v) => v.trim())])
    headers.set('Vary', [...merged].filter(Boolean).join(', '))
  }

  // A 304 must not carry a body, and the caller will use its cached copy.
  return new Response(upstream.status === 304 ? null : await upstream.text(), {
    status: upstream.status,
    headers
  })
}

/** Reads the bearer token straight from the Authorization header. */
function bearerFrom(request: Request): string | null {
  const header = request.headers.get('Authorization')
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1]!.trim() : null
}

/**
 * Both the code exchange and the refresh grant hit the same endpoint and
 * differ only in their body, so they share one request path.
 */
async function requestToken(env: Env, body: Record<string, string>): Promise<TokenSet | null> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': GITHUB_USER_AGENT
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      ...body
    })
  })

  const payload = (await response.json()) as GitHubTokenResponse
  if (payload.error || !payload.access_token) {
    console.error('token request failed:', payload.error ?? response.status)
    return null
  }
  return toTokenSet(payload)
}

const exchangeCode = (env: Env, code: string): Promise<TokenSet | null> =>
  requestToken(env, { code })

const refreshAccessToken = (env: Env, refreshToken: string): Promise<TokenSet | null> =>
  requestToken(env, { grant_type: 'refresh_token', refresh_token: refreshToken })

function toTokenSet(payload: GitHubTokenResponse): TokenSet {
  const now = Date.now()
  return {
    accessToken: payload.access_token as string,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_in ? now + payload.expires_in * 1000 : undefined,
    refreshTokenExpiresAt: payload.refresh_token_expires_in
      ? now + payload.refresh_token_expires_in * 1000
      : undefined
  }
}

function toSessionPayload(tokens: TokenSet): SessionPayload {
  return {
    accessToken: tokens.accessToken,
    issuedAt: Date.now(),
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt
  }
}

/**
 * Renew an expired access token, leaving a live one alone.
 *
 * Returns `null` only when the stored credentials can no longer be used, which
 * tells the caller to ask the visitor to sign in again.
 */
async function renewIfExpired(
  env: Env,
  payload: SessionPayload
): Promise<{ payload: SessionPayload; renewed: boolean } | null> {
  // No `expiresAt` means the App does not expire tokens, so nothing to do.
  const expiring = payload.expiresAt !== undefined
  if (!expiring || payload.expiresAt! - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return { payload, renewed: false }
  }

  if (!payload.refreshToken) {
    console.error('access token expired and no refresh token was issued')
    return null
  }
  if (payload.refreshTokenExpiresAt && payload.refreshTokenExpiresAt <= Date.now()) {
    console.error('refresh token expired')
    return null
  }

  const refreshed = await refreshAccessToken(env, payload.refreshToken)
  if (!refreshed) return null

  // GitHub may omit `refresh_token` on refresh, in which case the previous one
  // stays valid — keep it rather than dropping the ability to renew again.
  return {
    payload: toSessionPayload({
      ...refreshed,
      refreshToken: refreshed.refreshToken ?? payload.refreshToken
    }),
    renewed: true
  }
}

/* ------------------------------------------------------------------ *
 * GitHub App installation token
 * ------------------------------------------------------------------ */

/**
 * Resolve an installation token, cached in the Worker's memory for the
 * lifetime of the isolate.
 *
 * The cache is best-effort: isolates are ephemeral and may be evicted at any
 * time, so a miss simply costs one extra API round trip. That keeps the worker
 * stateless and free of any external KV dependency.
 */
async function installationToken(env: Env): Promise<string | null> {
  const cacheKey = `${env.GITHUB_APP_ID}\n${env.GITHUB_INSTALLATION_ID ?? ''}`
  const cached = installationTokenCache.get(cacheKey)
  if (cached && cached.expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
    return cached.token
  }

  const installationId = await resolveInstallationId(env)
  if (!installationId) {
    console.error('no installation found for this app')
    return null
  }

  const jwt = await signAppJwt(env)
  const response = await fetch(
    `${GITHUB_API}/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': GITHUB_USER_AGENT
      }
    }
  )

  if (!response.ok) {
    console.error('installation token request failed:', response.status)
    return null
  }

  const data = (await response.json()) as { token?: string; expires_at?: string }
  if (!data.token) return null

  installationTokenCache.set(cacheKey, {
    token: data.token,
    expiresAt: new Date(data.expires_at ?? Date.now() + 60 * 60 * 1000).getTime()
  })

  return data.token
}

/**
 * Whether `owner/repo` is a **public** repository.
 *
 * This is the boundary that stops an installation token — which can read every
 * repository the App is installed on — from serving a private repository to an
 * anonymous caller. A non-2xx response is treated as "not public": an App that
 * is not installed on a public repository must fall back to REST, not be
 * assumed harmless.
 *
 * Cached for `REPO_VISIBILITY_TTL_MS` so a thread's pages do not each pay this
 * request. A repository that turns private keeps its public verdict for at
 * most that TTL.
 */
async function isPublicRepository(owner: string, repo: string, token: string): Promise<boolean> {
  const cacheKey = `${owner.toLowerCase()}/${repo.toLowerCase()}`
  const cached = repoVisibilityCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.isPublic

  let isPublic = false
  try {
    const response = await fetch(
      `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2026-03-10',
          'User-Agent': GITHUB_USER_AGENT
        }
      }
    )
    if (response.ok) {
      const data = (await response.json()) as { private?: unknown; visibility?: unknown }
      // `private: false` is the documented signal. On GitHub Enterprise the
      // extra `visibility` field can be `internal`, which is still not public
      // to anonymous visitors, so require it to be `public` when present.
      isPublic =
        data.private === false && (data.visibility === undefined || data.visibility === 'public')
    }
  } catch {
    // Network failure: fail closed, but do not cache the negative verdict so
    // the next request can try again.
    return false
  }

  if (repoVisibilityCache.size >= REPO_CACHE_LIMIT) {
    const oldest = repoVisibilityCache.keys().next().value
    if (oldest !== undefined) repoVisibilityCache.delete(oldest)
  }
  repoVisibilityCache.set(cacheKey, {
    isPublic,
    expiresAt: Date.now() + REPO_VISIBILITY_TTL_MS
  })

  return isPublic
}

async function resolveInstallationId(env: Env): Promise<number | null> {
  // An explicit installation id avoids a discovery round trip.
  if (env.GITHUB_INSTALLATION_ID) return Number(env.GITHUB_INSTALLATION_ID)

  const jwt = await signAppJwt(env)
  const response = await fetch(`${GITHUB_API}/app/installations?per_page=1`, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': GITHUB_USER_AGENT
    }
  })
  if (!response.ok) {
    console.error('installation lookup failed:', response.status)
    return null
  }

  const list = (await response.json()) as Array<{ id: number }>
  return list[0]?.id ?? null
}

/**
 * Sign a short-lived JWT for the GitHub App.
 *
 * RS256 costs roughly 6-7 ms on a free-tier worker, which is inside the 10 ms
 * CPU budget — but close enough that we cache aggressively rather than signing
 * per request.
 */
async function signAppJwt(env: Env): Promise<string> {
  const key = await importPemKey(env.GITHUB_APP_PRIVATE_KEY)
  const now = Math.floor(Date.now() / 1000)

  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64Url(
    JSON.stringify({
      iat: now - 30, // clock drift tolerance
      exp: now + 600, // GitHub rejects anything over 10 minutes
      iss: env.GITHUB_APP_ID
    })
  )

  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(`${header}.${claims}`)
  )

  return `${header}.${claims}.${base64UrlBytes(new Uint8Array(signature))}`
}

/**
 * Import the GitHub App private key as a WebCrypto signing key.
 *
 * GitHub serves the key as PKCS#1 while `importKey` only takes PKCS#8, so the
 * envelope is rebuilt on the fly — see `./pkcs8`. Accepts the PEM either as
 * multi-line text or with newlines escaped as `\n`, which is how it has to be
 * stored in a `.env` file or a `wrangler secret`.
 */
async function importPemKey(pem: string): Promise<CryptoKey> {
  const binary = pemToPkcs8(pem)

  return crypto.subtle.importKey(
    'pkcs8',
    binary.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

function base64Url(input: string): string {
  return base64UrlBytes(new TextEncoder().encode(input))
}

function base64UrlBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/* ------------------------------------------------------------------ *
 * Session sealing
 * ------------------------------------------------------------------ */

/**
 * Seal a session with AES-GCM using the configured key.
 *
 * The token is never exposed in a URL; only this opaque blob is, and only for
 * the single redirect hop.
 */
async function sealSession(env: Env, payload: SessionPayload): Promise<string> {
  const key = await sessionKey(env)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))

  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return `${base64UrlBytes(iv)}.${base64UrlBytes(new Uint8Array(cipher))}`
}

async function openSession(env: Env, sealed: string): Promise<SessionPayload | null> {
  const [ivPart, dataPart] = sealed.split('.')
  if (!ivPart || !dataPart) return null

  try {
    const key = await sessionKey(env)
    const iv = fromBase64Url(ivPart)
    const data = fromBase64Url(dataPart)

    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      data.buffer as ArrayBuffer
    )
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as SessionPayload

    // Sessions expire; treat an old one as invalid rather than trusting it.
    if (Date.now() - payload.issuedAt > SESSION_TTL_SECONDS * 1000) return null
    return payload
  } catch {
    return null
  }
}

async function sessionKey(env: Env): Promise<CryptoKey> {
  const raw = hexToBytes(env.SESSION_ENCRYPTION_KEY)
  return crypto.subtle.importKey(
    'raw',
    raw.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

/* ------------------------------------------------------------------ *
 * helpers
 * ------------------------------------------------------------------ */

/**
 * Split `GITALK_ALLOWED_ORIGINS` into entries.
 *
 * This is deliberately the one and only parser for that value, shared with the
 * CORS check: comma-separated, whitespace-trimmed, empty entries dropped.
 * Entries are compared verbatim — both `URL.origin` and the browser's `Origin`
 * header are already normalized (lowercase scheme/host, no default port), and
 * docs/guide.md tells operators to write bare origins. Do not add a second set
 * of separator/case rules here.
 */
function allowedOriginList(allowed: string | undefined): string[] {
  return (allowed ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function corsHeaders(
  origin: string | null,
  allowed: string | undefined
): Record<string, string> {
  const list = allowedOriginList(allowed)

  const permit =
    !list.length || list.includes('*') || (origin && list.includes(origin))
      ? (origin ?? '*')
      : list[0]!

  return { 'Access-Control-Allow-Origin': permit, Vary: 'Origin' }
}

/**
 * Resolve a caller-supplied `return_to` to the target the callback may send the
 * visitor back to.
 *
 * `return_to` is the page that started the sign-in: the widget passes
 * `window.location.href` (see `packages/core/src/use-gitalk.ts`), i.e. an
 * absolute URL on the *blog's* origin. That origin is normally NOT this
 * worker's — the proxy runs on e.g. `gitalk-proxy.…workers.dev` while the
 * widget is embedded on `gitalk.github.io`. Requiring a match with `origin`
 * alone therefore rejects every legitimate return trip, the same mistake the
 * external PR made with a sentinel origin.
 *
 * Two kinds of target are trusted:
 *
 *   1. this proxy's own origin, returned as a relative form because
 *      `redirectBack` resolves it against `origin` again;
 *   2. an origin listed in `GITALK_ALLOWED_ORIGINS` — the existing "which
 *      sites may embed the widget" config. Those sites are cross-origin by
 *      definition, so the origin has to be serialized too, or `redirectBack`
 *      would resolve the path back onto the proxy.
 *
 * Everything else — off-list origins, protocol-relative or backslash tricks,
 * unparseable or absent values — falls back to `/` on this proxy.
 *
 * `GITALK_ALLOWED_ORIGINS`'s `*` wildcard is deliberately NOT honoured here.
 * It governs who may read CORS responses; treating it as a redirect allowlist
 * would let anyone mint a `state` and receive the sealed session in the
 * redirect. With the variable unset, only the proxy's own origin is accepted.
 *
 * Use a URL parser rather than a string-prefix check: the parser normalizes
 * `//host`, backslashes, embedded credentials and percent-encoding exactly the
 * way a browser will, which is the only comparison that reflects what the
 * browser actually navigates to.
 *
 * `origin` must be the same origin `redirectBack` will resolve against — i.e.
 * `url.origin` from the request being handled, which already reflects
 * `PUBLIC_ORIGIN` / forwarded headers at the platform adapter.
 */
function safeReturnTo(
  value: string | null,
  origin: string,
  allowed: string | undefined
): string {
  try {
    const target = new URL(value ?? '/', origin)

    // Fold leading slashes before serializing, in BOTH branches. A pathname
    // starting with `//` is a network-path reference, not a path:
    // `redirectBack` re-resolves whatever string comes back, so
    // `https://proxy.example//evil.com` (same-origin as a URL) would be handed
    // over as `//evil.com` and jump hosts. The same applies to the absolute
    // branch, where the string is parsed once more by `redirectBack`.
    const path = `${target.pathname.replace(/^\/+/, '/')}${target.search}${target.hash}`

    // This worker's own origin: relative form, resolved again by
    // `redirectBack`. Not serializing the origin also keeps the redirect
    // portable when the proxy is reached through a forwarded host.
    if (target.origin === origin) return path

    // An allowlisted blog origin: keep the origin, because `redirectBack`
    // resolves against the proxy and a bare path would land here instead of on
    // the page the visitor came from.
    if (allowedOriginList(allowed).includes(target.origin)) {
      return `${target.origin}${path}`
    }

    return '/'
  } catch {
    return '/'
  }
}

/**
 * Send the visitor back to their page with the result attached.
 *
 * The location is always resolved to an absolute URL: `Response.redirect`
 * throws on a relative one, so a missing or relative `return_to` would
 * otherwise turn into a 502 instead of a trip home.
 */
function redirectBack(
  returnTo: string,
  params: Record<string, string>,
  origin: string
): Response {
  const target = new URL(returnTo, origin)
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v)
  return Response.redirect(target.toString(), 302)
}

function safeEncode(value: string): string {
  return btoa(encodeURIComponent(value)).replace(/=+$/, '')
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(atob(value))
  } catch {
    return '/'
  }
}

interface ExecutionContext {
  props?: Record<string, unknown>
  waitUntil(promise: Promise<unknown>): void
}
