// @vitest-environment node
import { describe, expect, it, afterEach, vi } from 'vitest'
import { handle, type Env } from './index'

/**
 * These drive the real handler with GitHub stubbed out, so the whole
 * authorize → callback → token round trip is exercised as one flow. The
 * refresh path in particular is easy to get subtly wrong (rotated tokens,
 * expiry math) and impossible to reach by hand while the App does not expire
 * tokens.
 */

const PROXY_ORIGIN = 'https://proxy.example'
/** The site the widget is embedded on — a different origin from the proxy. */
const BLOG_ORIGIN = 'https://site.example'

const ENV: Env = {
  GITHUB_APP_ID: '1',
  GITHUB_APP_PRIVATE_KEY: 'unused-in-these-tests',
  GITHUB_CLIENT_ID: 'Iv23liTestClient',
  GITHUB_CLIENT_SECRET: 'client-secret',
  SESSION_ENCRYPTION_KEY: 'ab'.repeat(32),
  GITALK_ALLOWED_ORIGINS: BLOG_ORIGIN
}

// The worker keeps its ExecutionContext interface private, so borrow the type
// rather than redeclaring it and risking drift.
type WorkerContext = Parameters<typeof handle>[2]

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as WorkerContext

const call = (path: string, init?: RequestInit, env: Env = ENV) =>
  handle(new Request(`${PROXY_ORIGIN}${path}`, init), env, ctx)

/** The `state` value /oauth/authorize mints for a given return target. */
const encodeState = (value: string) => btoa(encodeURIComponent(value)).replace(/=+$/, '')

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })

/** Stub GitHub, replying with `responses` in order and recording the bodies. */
function mockGitHub(...responses: unknown[]) {
  const sent: Array<Record<string, unknown>> = []
  let index = 0
  vi.stubGlobal('fetch', async (_input: RequestInfo | URL, init?: RequestInit) => {
    sent.push(init?.body ? JSON.parse(String(init.body)) : {})
    return json(responses[Math.min(index++, responses.length - 1)])
  })
  return sent
}

/** Run the callback with stubbed GitHub and return the sealed session. */
async function obtainSession(tokenResponse: unknown): Promise<string> {
  mockGitHub(tokenResponse)
  const state = encodeState(`${BLOG_ORIGIN}/post`)
  const response = await call(`/oauth/callback?code=abc&state=${state}`)

  const location = new URL(response.headers.get('Location') as string)
  const session = location.searchParams.get('gitalk_session')
  expect(session).toBeTruthy()
  return session as string
}

const exchange = (session: string) =>
  call('/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session })
  })

afterEach(() => vi.restoreAllMocks())

describe('/oauth/authorize', () => {
  it('sends the visitor to GitHub with the callback this worker serves', async () => {
    // What the widget actually sends: `window.location.href`, i.e. an absolute
    // URL on the blog's origin. The blog is cross-origin from the proxy, so
    // this has to survive as an absolute target in `state`.
    const returnTo = `${BLOG_ORIGIN}/post`
    const response = await call(`/oauth/authorize?return_to=${encodeURIComponent(returnTo)}`)
    expect(response.status).toBe(302)

    const location = new URL(response.headers.get('Location') as string)
    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(location.searchParams.get('client_id')).toBe(ENV.GITHUB_CLIENT_ID)
    expect(location.searchParams.get('redirect_uri')).toBe(`${PROXY_ORIGIN}/oauth/callback`)
    // `state` is opaque to GitHub; what matters is that the callback can
    // recover the original page from it.
    const state = location.searchParams.get('state') as string
    expect(decodeURIComponent(atob(state))).toBe(returnTo)
  })

  it('mints a relative state for a target on its own origin', async () => {
    // `redirectBack` resolves against the proxy, so its own origin must not be
    // serialized into `state` — and the target must not be degraded to `/`.
    const returnTo = `${PROXY_ORIGIN}/post?x=1#y`
    const response = await call(`/oauth/authorize?return_to=${encodeURIComponent(returnTo)}`)

    const location = new URL(response.headers.get('Location') as string)
    const state = location.searchParams.get('state') as string
    expect(decodeURIComponent(atob(state))).toBe('/post?x=1#y')
  })

  it('rejects a return_to whose origin is not allowlisted', async () => {
    const response = await call(
      `/oauth/authorize?return_to=${encodeURIComponent('https://evil.example/x')}`
    )

    const location = new URL(response.headers.get('Location') as string)
    expect(decodeURIComponent(atob(location.searchParams.get('state') as string))).toBe('/')
  })

  it('omits scope, which a GitHub App ignores anyway', async () => {
    const response = await call('/oauth/authorize')
    const location = new URL(response.headers.get('Location') as string)
    expect(location.searchParams.has('scope')).toBe(false)
  })
})

describe('/oauth/callback', () => {
  it('hands the session back to the page without exposing the token', async () => {
    const session = await obtainSession({ access_token: 'gho_secret' })

    // The raw token must never reach a URL: those leak into history, referrers
    // and server logs.
    expect(session).not.toContain('gho_secret')
    expect(decodeURIComponent(session)).not.toContain('gho_secret')
  })

  it('reports a denied authorization instead of failing silently', async () => {
    const response = await call('/oauth/callback?error=access_denied&state=')
    const location = response.headers.get('Location') as string
    expect(location).toContain('error=access_denied')
  })
})

/* ------------------------------------------------------------------ *
 * `return_to` may only point at this worker or an allowlisted blog origin
 * ------------------------------------------------------------------ */

/**
 * Drive /oauth/callback with `state` carrying `returnTo` and return the
 * redirect target. Passing `null` omits `state` entirely.
 *
 * The assertions below check `Location`'s origin rather than the status code:
 * every branch answers 302, and the sealed `gitalk_session` rides in that
 * redirect, so the origin is the security boundary.
 */
async function callbackLocation(returnTo: string | null, env: Env = ENV): Promise<URL> {
  mockGitHub({ access_token: 'gho_test' })
  const query = returnTo === null ? '' : `&state=${encodeURIComponent(encodeState(returnTo))}`
  const response = await call(`/oauth/callback?code=abc${query}`, undefined, env)
  expect(response.status).toBe(302)

  const location = response.headers.get('Location')
  expect(location).toBeTruthy()
  return new URL(location as string)
}

const backslashTargets: Array<[string, string]> = [
  ['two leading backslashes', '\\\\evil.com'],
  ['slash then backslash', '/\\evil.com'],
  ['backslashes after the scheme', 'https://evil.com\\x']
]

const missingTargets: Array<[string, string | null]> = [
  ['missing', null],
  ['empty', '']
]

describe('return_to validation', () => {
  it('returns to an absolute URL on an allowlisted blog origin', async () => {
    // This is exactly what the widget sends (`window.location.href`). The blog
    // and the proxy are different origins, so a strict same-origin check would
    // drop the visitor on the proxy's `/` instead of their own page — the bug
    // this policy exists to avoid.
    const location = await callbackLocation(`${BLOG_ORIGIN}/post?x=1#y`)

    expect(location.origin).toBe(BLOG_ORIGIN)
    expect(location.pathname).toBe('/post')
    expect(location.searchParams.get('x')).toBe('1')
    expect(location.hash).toBe('#y')
    // The session must land on the blog, where the widget can redeem it.
    expect(location.searchParams.get('gitalk_session')).toBeTruthy()
  })

  it('trims allowlist entries the way the CORS check does', async () => {
    // Production value shape: several origins, comma separated. `corsHeaders`
    // trims each entry, so this must too — otherwise an origin listed after a
    // space is accepted by CORS but rejected here, breaking its sign-in.
    const env: Env = {
      ...ENV,
      GITALK_ALLOWED_ORIGINS: 'https://gitalk.github.io, http://127.0.0.1:4181'
    }
    const location = await callbackLocation('http://127.0.0.1:4181/post', env)

    expect(location.origin).toBe('http://127.0.0.1:4181')
    expect(location.pathname).toBe('/post')
  })

  it('does not redirect an absolute off-site target', async () => {
    const location = await callbackLocation('https://evil.com/x')

    expect(location.origin).toBe(PROXY_ORIGIN)
    expect(location.hostname).not.toBe('evil.com')
    expect(location.pathname).toBe('/')
    // The session is still handed back — to us, not to the attacker.
    expect(location.searchParams.get('gitalk_session')).toBeTruthy()
  })

  it('does not accept an origin that merely starts with an allowlisted one', async () => {
    // Guards against a prefix/`startsWith` check drifting in: the comparison
    // has to be on the parsed origin, not on the raw string.
    const location = await callbackLocation(`${BLOG_ORIGIN}.evil.example/x`)

    expect(location.origin).toBe(PROXY_ORIGIN)
    expect(location.pathname).toBe('/')
  })

  it('does not redirect a protocol-relative target', async () => {
    const location = await callbackLocation('//evil.com/x')

    expect(location.origin).toBe(PROXY_ORIGIN)
    expect(location.hostname).not.toBe('evil.com')
  })

  // A browser normalizes backslashes to slashes for special schemes, so a
  // prefix check that treats them as ordinary path characters is bypassable.
  it.each(backslashTargets)('does not redirect a target hidden behind %s', async (_label, returnTo) => {
    const location = await callbackLocation(returnTo)

    expect(location.origin).toBe(PROXY_ORIGIN)
  })

  // These are same-origin by `URL.origin`, but their path starts with `//`, so
  // the relative form handed to `redirectBack` would re-resolve as a
  // network-path reference and leave the origin.
  it.each([
    ['a double slash', `${PROXY_ORIGIN}//evil.com`],
    ['a backslash path', `${PROXY_ORIGIN}/\\evil.com`]
  ])('does not let a proxy-origin URL escape via %s', async (_label, returnTo) => {
    const location = await callbackLocation(returnTo)

    expect(location.origin).toBe(PROXY_ORIGIN)
    expect(location.hostname).not.toBe('evil.com')
  })

  // The absolute branch is parsed a second time by `redirectBack`, so it needs
  // the same leading-slash fold as the relative branch.
  it.each([
    ['a double slash', `${BLOG_ORIGIN}//evil.com`],
    ['a backslash path', `${BLOG_ORIGIN}/\\evil.com`]
  ])('does not let an allowlisted URL escape via %s', async (_label, returnTo) => {
    const location = await callbackLocation(returnTo)

    expect(location.origin).toBe(BLOG_ORIGIN)
    expect(location.hostname).not.toBe('evil.com')
    expect(location.pathname).toBe('/evil.com')
  })

  it('returns to a URL on its own origin in relative form', async () => {
    // Relative-vs-absolute is pinned directly on the value authorize mints for
    // `state` (see above); this only checks the return trip still works.
    const location = await callbackLocation(`${PROXY_ORIGIN}/post?x=1#y`)

    expect(location.origin).toBe(PROXY_ORIGIN)
    expect(location.pathname).toBe('/post')
    expect(location.searchParams.get('x')).toBe('1')
    expect(location.hash).toBe('#y')
    expect(location.searchParams.get('gitalk_session')).toBeTruthy()
  })

  it('keeps the path, query and hash of a relative target', async () => {
    const location = await callbackLocation('/foo?x=1#y')

    expect(location.origin).toBe(PROXY_ORIGIN)
    expect(location.pathname).toBe('/foo')
    expect(location.searchParams.get('x')).toBe('1')
    expect(location.hash).toBe('#y')
  })

  it('only trusts its own origin when GITALK_ALLOWED_ORIGINS is unset', async () => {
    // Fail closed: an empty configuration must not mean "any site is a valid
    // return target", or a missing variable turns into an open redirect that
    // leaks the sealed session.
    const env: Env = { ...ENV, GITALK_ALLOWED_ORIGINS: undefined }

    const denied = await callbackLocation(`${BLOG_ORIGIN}/post`, env)
    expect(denied.origin).toBe(PROXY_ORIGIN)
    expect(denied.pathname).toBe('/')

    const allowed = await callbackLocation(`${PROXY_ORIGIN}/post`, env)
    expect(allowed.origin).toBe(PROXY_ORIGIN)
    expect(allowed.pathname).toBe('/post')
  })

  it('does not treat the CORS wildcard as a redirect permit', async () => {
    // `*` lets any site embed the widget; it must not let any site receive the
    // session, which is what honouring it here would do.
    const env: Env = { ...ENV, GITALK_ALLOWED_ORIGINS: '*' }

    const location = await callbackLocation(`${BLOG_ORIGIN}/post`, env)
    expect(location.origin).toBe(PROXY_ORIGIN)
    expect(location.pathname).toBe('/')
  })

  it.each(missingTargets)('falls back to / when return_to is %s', async (_label, returnTo) => {
    const location = await callbackLocation(returnTo)

    expect(location.origin).toBe(PROXY_ORIGIN)
    expect(location.pathname).toBe('/')
    expect(location.searchParams.get('gitalk_session')).toBeTruthy()
  })

  it('scrubs the target in authorize and re-checks a forged state on the way back', async () => {
    // Gate one: what /oauth/authorize puts in `state` is already sanitized.
    const authorize = await call(
      `/oauth/authorize?return_to=${encodeURIComponent('https://evil.com/x')}`
    )
    const github = new URL(authorize.headers.get('Location') as string)
    expect(decodeURIComponent(atob(github.searchParams.get('state') as string))).toBe('/')

    // Gate two: `state` is unsigned, so an attacker can mint one carrying an
    // off-site target without ever calling /oauth/authorize. The callback must
    // reject it on its own.
    mockGitHub({ access_token: 'gho_test' })
    const forged = encodeState('https://evil.com/x')
    const response = await call(`/oauth/callback?code=abc&state=${encodeURIComponent(forged)}`)
    const location = new URL(response.headers.get('Location') as string)

    expect(location.origin).toBe(PROXY_ORIGIN)
    expect(location.hostname).not.toBe('evil.com')
  })
})

describe('/oauth/token', () => {
  it('returns the token without calling GitHub when it has not expired', async () => {
    const session = await obtainSession({ access_token: 'fresh' })
    // The callback consumed the only stubbed response; a call here would throw.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('should not be called'))))

    const body = await (await exchange(session)).json()
    expect(body.access_token).toBe('fresh')
    expect(body.session).toBeUndefined()
  })

  it('refreshes an expired token and returns the rotated session', async () => {
    const session = await obtainSession({
      access_token: 'expired',
      refresh_token: 'r1',
      expires_in: -10
    })

    const sent = mockGitHub({
      access_token: 'renewed',
      refresh_token: 'r2',
      expires_in: 3600
    })
    const body = await (await exchange(session)).json()

    expect(body.access_token).toBe('renewed')
    expect(sent[0]?.grant_type).toBe('refresh_token')
    expect(sent[0]?.refresh_token).toBe('r1')
    // GitHub rotates the refresh token, so the client must swap its session.
    expect(body.session).toBeTruthy()
    expect(body.session).not.toBe(session)
    expect(body.expires_in).toBeGreaterThan(0)
  })

  it('scopes the refresh request to the App, not to the visitor', async () => {
    const session = await obtainSession({
      access_token: 'expired',
      refresh_token: 'r1',
      expires_in: -10
    })
    const sent = mockGitHub({ access_token: 'renewed', expires_in: 3600 })
    await exchange(session)

    // A refresh with a visitor's token would be a privilege escalation.
    expect(sent[0]?.client_secret).toBe(ENV.GITHUB_CLIENT_SECRET)
    expect(sent[0]?.client_id).toBe(ENV.GITHUB_CLIENT_ID)
  })

  it('keeps the previous refresh token when GitHub does not return a new one', async () => {
    const session = await obtainSession({
      access_token: 'expired',
      refresh_token: 'r1',
      expires_in: -10
    })

    // First refresh returns no refresh_token, but it stays valid.
    mockGitHub({ access_token: 'renewed-1', expires_in: -10 })
    const first = await (await exchange(session)).json()
    expect(first.session).toBeTruthy()

    const sent = mockGitHub({ access_token: 'renewed-2', expires_in: 3600 })
    const second = await (await exchange(first.session)).json()

    expect(second.access_token).toBe('renewed-2')
    expect(sent[0]?.refresh_token).toBe('r1')
  })

  it('asks the visitor to sign in again when the token expired with no way to renew', async () => {
    const session = await obtainSession({ access_token: 'expired', expires_in: -10 })

    const response = await exchange(session)
    expect(response.status).toBe(401)
    expect((await response.json()).error).toMatch(/sign in again/i)
  })

  it('rejects a session that was not issued by this worker', async () => {
    const response = await exchange('not.a-real-session')
    expect(response.status).toBe(401)
  })

  it('rejects a session sealed with a different key', async () => {
    const session = await obtainSession({ access_token: 'tok' })

    const other = {
      ...ENV,
      SESSION_ENCRYPTION_KEY: 'cd'.repeat(32)
    }
    const response = await handle(
      new Request('https://proxy.example/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session })
      }),
      other,
      ctx
    )

    expect(response.status).toBe(401)
  })
})

describe('/graphql', () => {
  it('forwards createDiscussion verbatim, authenticated as the visitor', async () => {
    const sent: Array<{ url: string; auth: string | null; body: unknown; nextId: string | null }> = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = (init?.headers as Record<string, string> | undefined) ?? {}
      sent.push({
        url: String(input),
        auth: headers.Authorization ?? null,
        body: init?.body ? JSON.parse(String(init.body)) : null,
        nextId: headers['X-Github-Next-Global-ID'] ?? null
      })
      return json({ data: { createDiscussion: { discussion: { number: 7 } } } })
    })

    // The forwarder has no operation allowlist (see `handleGraphql`), so this
    // pins the property the discussions backend depends on: a GraphQL mutation
    // it sends is not filtered out, and it runs as the visitor rather than as
    // the App, because `createDiscussion` is attributed to its token's owner.
    const body = {
      query:
        'mutation gitalkCreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) { createDiscussion(input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body }) { discussion { id number title url locked } } }',
      variables: { repositoryId: 'R_1', categoryId: 'DIC_1', title: 't', body: 'b' }
    }

    const response = await call('/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer gho_visitor',
        'X-Github-Next-Global-ID': '1'
      },
      body: JSON.stringify(body)
    })

    expect(response.status).toBe(200)
    expect((await response.json()).data.createDiscussion.discussion.number).toBe(7)
    expect(sent[0]?.url).toBe('https://api.github.com/graphql')
    expect(sent[0]?.auth).toBe('Bearer gho_visitor')
    expect(sent[0]?.body).toEqual(body)
    // The opt-in must survive the proxy hop, otherwise GraphQL responses go
    // back to legacy ids even though the widget asked for new ones.
    expect(sent[0]?.nextId).toBe('1')
  })

  it('refuses anonymous GraphQL instead of borrowing the installation token', async () => {
    let called = false
    vi.stubGlobal('fetch', async () => {
      called = true
      return json({ data: {} })
    })

    const response = await call('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'mutation { addDiscussionComment(input: {}) { clientMutationId } }' })
    })

    expect(response.status).toBe(401)
    // The installation token carries the App's write access, so falling back
    // to it would let any caller mutate as the App. Nothing may reach GitHub.
    expect(called).toBe(false)
  })

  it('lets the next-global-id opt-in through CORS preflight', async () => {
    // The widget sends this custom header on every GraphQL request. A missing
    // entry here fails the preflight silently, so the request never reaches
    // this handler at all.
    const response = await call('/graphql', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://site.example',
        'Access-Control-Request-Headers': 'authorization,x-github-next-global-id'
      }
    })

    expect(response.status).toBe(204)
    // The header is echoed as the browser wrote it, and header names are
    // case-insensitive, so compare folded. What matters is that it is present.
    expect(response.headers.get('Access-Control-Allow-Headers')!.toLowerCase()).toContain(
      'x-github-next-global-id'
    )
  })
})
