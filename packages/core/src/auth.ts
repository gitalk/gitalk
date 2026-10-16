import { GitalkError } from './api/client'

const STORAGE_KEY = 'GT_ACCESS_TOKEN'
const DRAFT_KEY = 'GT_COMMENT'
const SCOPES = 'public_repo'

export interface TokenResponse {
  access_token: string
  error?: string
  error_description?: string
}

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'

/**
 * Authentication for Gitalk 2.0.
 *
 * ## Why this looks different from v1
 *
 * v1 shipped `clientID` + `clientSecret` into the page and posted them to a
 * third-party CORS proxy so the browser could complete the OAuth code
 * exchange. That design leaked both secrets and every visitor's OAuth code to
 * an unrelated server.
 *
 * Neither Rescue works as-is:
 *  - **Redirect flow**: `github.com/login/oauth/access_token` sends no
 *    `Access-Control-Allow-Origin`, so a browser cannot read the exchange.
 *  - **Device flow**: verified to genuinely require NO client_secret — but the
 *    same missing CORS headers block it. (Measured: `api.github.com` returns
 *    `access-control-allow-origin: *` under identical conditions, so this is a
 *    real header difference, not a measurement artifact.)
 *
 * Hence there is no way for a purely static page to mint a token. 2.0 keeps
 * the secret *out of the browser* by delegating the exchange to an edge
 * function the site owner deploys themselves: {@link TokenProxy}.
 * See docs/tech.md §3.
 */
export class Auth {
  private token: string | null = null

  constructor(private readonly options: AuthOptions) {
    this.token = readStoredToken()
  }

  getToken(): string | null {
    return this.token
  }

  isAuthenticated(): boolean {
    return Boolean(this.token)
  }

  /**
   * Build the GitHub authorize URL. The redirect target is the token proxy,
   * which completes the exchange away from the browser.
   */
  loginUrl(redirectTo: string): string {
    if (!this.options.proxy) {
      throw new GitalkError(
        'No `proxy` configured. Deploy packages/proxy-worker to your own ' +
          'Cloudflare/Vercel/Netlify account and pass its URL — the OAuth ' +
          'exchange cannot run in a browser (github.com sends no CORS headers).'
      )
    }

    if (!this.options.clientID) {
      throw new GitalkError('`clientID` is required to sign in')
    }

    const params = new URLSearchParams({
      client_id: this.options.clientID,
      redirect_uri: this.options.proxy,
      scope: SCOPES,
      state: redirectTo
    })
    return `${AUTHORIZE_URL}?${params}`
  }

  /** Persist draft so a round trip to GitHub does not lose it. */
  saveDraft(body: string): void {
    if (!body) return
    trySafe(() => localStorage.setItem(DRAFT_KEY, encodeURIComponent(body)))
  }

  takeDraft(): string {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return ''
      localStorage.removeItem(DRAFT_KEY)
      return decodeURIComponent(raw)
    } catch {
      return ''
    }
  }

  logout(): void {
    this.token = null
    trySafe(() => localStorage.removeItem(STORAGE_KEY))
  }
}

export interface AuthOptions {
  clientID: string
  proxy?: string
}

export interface TokenProxy {
  exchange(params: {
    endpoint: string
    clientID: string
    clientSecret: string
    code: string
  }): Promise<string>
}

function readStoredToken(): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeToken(token: string): void {
  trySafe(() => localStorage.setItem(STORAGE_KEY, token))
}

function trySafe(fn: () => void): void {
  try {
    fn()
  } catch {
    // storage disabled (private mode) — non-fatal
  }
}

export const TOKEN_STORAGE_KEY = STORAGE_KEY
