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
 *   *    /graphql               -> proxied GraphQL using the visitor's token,
 *                                 or the installation token when anonymous
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
  /** Comma-separated origin allowlist, or `*`. */
  GITALK_ALLOWED_ORIGINS: string
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

interface InstallationToken {
  token: string
  expiresAt: number
}

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
        // The widget sends Authorization once a visitor signs in. Leaving it
        // out made every authenticated write fail the preflight — anonymous
        // reads do not send it, so the endpoint looked healthy.
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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
  const returnTo = url.searchParams.get('return_to') ?? '/'

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

  const returnTo = state ? safeDecode(state) : '/'
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
 * Authenticated callers send their own token and we forward verbatim, so
 * writes are attributed to the real user. Anonymous callers get the
 * installation token, which is what lifts the read limit to 5,000/hr.
 */
async function handleGraphql(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  cors: Record<string, string>
): Promise<Response> {
  const body = await request.text()

  const userToken = bearerFrom(request)
  const token = userToken ?? (await installationToken(env, ctx))

  if (!token) return json({ error: 'No usable GitHub credential' }, { status: 503, headers: cors })

  const upstream = await fetch(`${GITHUB_API}/graphql`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': GITHUB_USER_AGENT
    },
    body
  })

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', ...cors }
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
async function installationToken(env: Env, ctx: ExecutionContext): Promise<string | null> {
  const cached = ctx.props?.installation as InstallationToken | undefined
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

  ctx.props = {
    installation: {
      token: data.token,
      expiresAt: new Date(data.expires_at ?? Date.now() + 60 * 60 * 1000).getTime()
    } satisfies InstallationToken
  }

  return data.token
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

function corsHeaders(origin: string | null, allowed: string): Record<string, string> {
  const list = (allowed ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const permit =
    !list.length || list.includes('*') || (origin && list.includes(origin))
      ? (origin ?? '*')
      : list[0]!

  return { 'Access-Control-Allow-Origin': permit, Vary: 'Origin' }
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
