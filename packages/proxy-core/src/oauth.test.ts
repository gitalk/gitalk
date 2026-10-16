// @vitest-environment node
import { describe, expect, it, afterEach, vi } from 'vitest'
import { handle } from './index'

/**
 * These drive the real handler with GitHub stubbed out, so the whole
 * authorize → callback → token round trip is exercised as one flow. The
 * refresh path in particular is easy to get subtly wrong (rotated tokens,
 * expiry math) and impossible to reach by hand while the App does not expire
 * tokens.
 */

const ENV = {
  GITHUB_APP_ID: '1',
  GITHUB_APP_PRIVATE_KEY: 'unused-in-these-tests',
  GITHUB_CLIENT_ID: 'Iv23liTestClient',
  GITHUB_CLIENT_SECRET: 'client-secret',
  SESSION_ENCRYPTION_KEY: 'ab'.repeat(32),
  GITALK_ALLOWED_ORIGINS: 'https://site.example'
}

// The worker keeps its ExecutionContext interface private, so borrow the type
// rather than redeclaring it and risking drift.
type WorkerContext = Parameters<typeof handle>[2]

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as WorkerContext

const call = (path: string, init?: RequestInit) =>
  handle(new Request(`https://proxy.example${path}`, init), ENV, ctx)

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
  const state = btoa(encodeURIComponent('https://site.example/post')).replace(/=+$/, '')
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
    const response = await call('/oauth/authorize?return_to=https%3A%2F%2Fsite.example%2Fpost')
    expect(response.status).toBe(302)

    const location = new URL(response.headers.get('Location') as string)
    expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(location.searchParams.get('client_id')).toBe(ENV.GITHUB_CLIENT_ID)
    expect(location.searchParams.get('redirect_uri')).toBe('https://proxy.example/oauth/callback')
    // `state` is opaque to GitHub; what matters is that the callback can
    // recover the original page from it.
    const state = location.searchParams.get('state') as string
    expect(decodeURIComponent(atob(state))).toBe('https://site.example/post')
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
    const sent: Array<{ url: string; auth: string | null; body: unknown }> = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      sent.push({
        url: String(input),
        auth: (init?.headers as Record<string, string> | undefined)?.Authorization ?? null,
        body: init?.body ? JSON.parse(String(init.body)) : null
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
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer gho_visitor' },
      body: JSON.stringify(body)
    })

    expect(response.status).toBe(200)
    expect((await response.json()).data.createDiscussion.discussion.number).toBe(7)
    expect(sent[0]?.url).toBe('https://api.github.com/graphql')
    expect(sent[0]?.auth).toBe('Bearer gho_visitor')
    expect(sent[0]?.body).toEqual(body)
  })
})
