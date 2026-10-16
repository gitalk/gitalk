/**
 * Cloudflare Worker implementing the token exchange that a browser cannot.
 *
 * Background: `github.com/login/oauth/access_token` returns no
 * `Access-Control-Allow-Origin`, so the OAuth code exchange cannot happen in
 * the page — that is why v1 resorted to a third-party CORS proxy, leaking both
 * the client secret and visitor codes to an unrelated server.
 *
 * This worker is small enough to audit and runs on YOUR account, so no third
 * party observes the traffic. Deploy once:
 *
 *   npm i -g wrangler
 *   wrangler secret put GITALK_CLIENT_ID
 *   wrangler secret put GITALK_CLIENT_SECRET
 *   wrangler deploy
 *
 * Then point gitalk's `proxy` option at the deployed URL.
 *
 * @see docs/tech.md §3.3
 */
export interface Env {
  GITALK_CLIENT_ID: string
  GITALK_CLIENT_SECRET: string
  /** Comma-separated origin allowlist, e.g. "https://example.com". "*" disables the check. */
  GITALK_ALLOWED_ORIGINS: string
}

const TOKEN_URL = 'https://github.com/login/oauth/access_token'

interface TokenOK {
  access_token: string
  scope?: string
  token_type?: string
}

interface TokenErr {
  error?: string
  error_description?: string
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers }
  })

/** Restrict which sites may use this worker. */
function corsHeaders(origin: string | null, allowed: string): Record<string, string> {
  const list = (allowed ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const permit = !list.length || list.includes('*') || (origin && list.includes(origin))
    ? (origin ?? '*')
    : list[0]!

  return {
    'Access-Control-Allow-Origin': permit,
    Vary: 'Origin'
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin, env.GITALK_ALLOWED_ORIGINS)

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'GET,OPTIONS' }
      })
    }

    if (url.pathname !== '/') return json({ error: 'Not found' }, { status: 404, headers: cors })

    if (!env.GITALK_CLIENT_ID || !env.GITALK_CLIENT_SECRET) {
      return json(
        { error: 'Worker is missing GITALK_CLIENT_ID / GITALK_CLIENT_SECRET' },
        { status: 500, headers: cors }
      )
    }

    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code) return json({ error: '`code` is required' }, { status: 400, headers: cors })

    // GitHub must send the user somewhere; `state` carries their origin page.
    const userToken = await exchange(env, code)
    if (typeof userToken === 'string') {
      return json({ error: userToken }, { status: 502, headers: cors })
    }

    if (state && state.startsWith('http')) {
      const back = new URL(state)
      back.searchParams.set('gitalk_token', userToken.access_token)
      return Response.redirect(back.toString(), 302)
    }

    // No redirect target: return JSON for SPA-style consumption.
    return json({ access_token: userToken.access_token }, { headers: cors })
  }
} satisfies ExportedHandler<Env>

async function exchange(env: Env, code: string): Promise<TokenOK | string> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITALK_CLIENT_ID,
      client_secret: env.GITALK_CLIENT_SECRET,
      code
    })
  })

  const payload = (await response.json()) as TokenOK & TokenErr
  if (payload.error) {
    return payload.error_description || payload.error
  }
  if (!payload.access_token) return 'Token exchange returned no access_token'
  return payload
}

interface ExportedHandler<E> {
  fetch(request: Request, env: E): Promise<Response>
}
