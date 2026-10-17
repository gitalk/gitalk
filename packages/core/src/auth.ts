import { GitalkError } from './api/client'

const STORAGE_KEY = 'GT_ACCESS_TOKEN'
const SESSION_KEY = 'GT_SESSION'
const EXPIRES_KEY = 'GT_TOKEN_EXPIRES_AT'
const DRAFT_KEY = 'GT_COMMENT'

/**
 * Default token-exchange endpoint.
 *
 * v1 shipped the OAuth `client_secret` into the page and posted it to a
 * third-party CORS proxy (`cors-anywhere.azm.workers.dev`) so the browser could
 * complete the exchange. That leaked both the secret and every visitor's code
 * to an unrelated server.
 *
 * There is no way around a server here: `github.com/login/oauth/access_token`
 * sends no `Access-Control-Allow-Origin`, and neither does the device-flow
 * endpoint (verified — `api.github.com` returns `ACAO: *` under identical
 * conditions, so it is a real header difference, not a measurement artifact).
 *
 * So 2.0 points at a worker this project runs. Users who would rather not
 * trust it can deploy `packages/proxy-worker` themselves and override `proxy`.
 * See docs/tech.md §3.
 */
export const DEFAULT_PROXY = 'https://gitalk-proxy.aispin-abf.workers.dev'

export interface AuthOptions {
  clientID: string
  /** Override the token-exchange endpoint (e.g. a self-hosted worker). */
  proxy?: string
}

/** What `POST <proxy>/oauth/token` answers with. */
interface TokenResponse {
  access_token?: string
  expires_in?: number
  /** Present only when the worker rotated the refresh token. */
  session?: string
}

export class Auth {
  private token: string | null = null
  private session: string | null = null
  /** Epoch ms at which `token` stops working; 0 means it never expires. */
  private expiresAt = 0

  constructor(private readonly options: AuthOptions) {
    this.token = readStored(STORAGE_KEY)
    this.session = readStored(SESSION_KEY)
    this.expiresAt = Number(readStored(EXPIRES_KEY) ?? 0) || 0
  }

  /**
   * The token to send with API calls, or `null` when there is nothing usable.
   *
   * An expired token is reported as absent rather than returned: GitHub would
   * answer 401 to every request, whereas `null` lets the widget fall back to
   * anonymous reads that still work.
   */
  getToken(): string | null {
    if (this.token && this.isExpired()) return null
    return this.token
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null
  }

  /**
   * Whether the stored token is a GitHub App user-to-server token (`ghu_`).
   *
   * Token prefixes are documented at
   * https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github#githubs-token-formats
   * (`ghu_` App user token, `gho_` OAuth App token, `ghp_`/`github_pat_` PAT).
   *
   * The distinction is load-bearing for upvotes: GitHub rejects `addUpvote` /
   * `removeUpvote` for app-issued user tokens with "Resource not accessible by
   * integration", even when the App holds `Discussions: write`. GitHub staff
   * confirmed the limitation, and it is still open:
   * https://github.com/orgs/community/discussions/3968
   */
  isAppUserToken(): boolean {
    return (this.getToken() ?? '').startsWith('ghu_')
  }

  /**
   * Whether signing in can actually be attempted.
   *
   * The UI uses this to hide the login affordance instead of throwing at click
   * time: a misconfigured widget should degrade quietly, not blow up the page.
   */
  canLogin(): boolean {
    return Boolean(this.options.clientID)
  }

  get proxy(): string {
    return this.options.proxy || DEFAULT_PROXY
  }

  /** Whether we hold a session that can still be exchanged for a token. */
  hasSession(): boolean {
    return Boolean(this.session)
  }

  /**
   * URL that starts the OAuth round trip.
   *
   * This points at the worker's `/oauth/authorize` rather than at GitHub
   * directly. The worker owns the `client_secret`, knows its own public origin,
   * and mints the `state` value — so redirect target and state can never drift
   * out of sync with what `/oauth/callback` expects. Building the GitHub URL
   * here would mean duplicating those three decisions in the browser.
   */
  loginUrl(redirectTo: string): string {
    if (!this.options.clientID) {
      throw new GitalkError(
        '`clientID` is required to sign in. Create a GitHub App and pass ' +
          'its client id in the gitalk options.'
      )
    }

    const params = new URLSearchParams({ return_to: redirectTo })
    return `${this.proxy.replace(/\/$/, '')}/oauth/authorize?${params}`
  }

  /**
   * Redeem a session handed back by the worker after the OAuth round trip.
   *
   * The session — not the token — is what gets persisted. A token expires;
   * the session is what lets us get a new one without troubling the visitor.
   */
  async completeLogin(session: string): Promise<boolean> {
    this.session = session
    writeStored(SESSION_KEY, session)
    return this.refresh()
  }

  /**
   * Exchange the stored session for a fresh access token.
   *
   * Returns false and forgets the session when it can no longer be redeemed,
   * so the UI can fall back to the signed-out state instead of retrying a dead
   * credential forever.
   */
  async refresh(): Promise<boolean> {
    if (!this.session) return false

    let payload: TokenResponse
    try {
      const response = await fetch(`${this.proxy.replace(/\/$/, '')}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: this.session })
      })
      if (!response.ok) {
        this.forgetSession()
        return false
      }
      payload = (await response.json()) as TokenResponse
    } catch {
      // Network failure is not proof the session is bad — keep it and let a
      // later attempt try again.
      return false
    }

    if (!payload.access_token) {
      this.forgetSession()
      return false
    }

    this.setToken(payload.access_token, payload.expires_in)
    // The worker rotates the refresh token on every renewal, so the previous
    // session is now stale and must be replaced.
    if (payload.session) {
      this.session = payload.session
      writeStored(SESSION_KEY, payload.session)
    }
    return true
  }

  /** Persist draft so a round trip to GitHub does not lose it. */
  saveDraft(body: string): void {
    if (!body) return
    trySafe(() => localStorage.setItem(DRAFT_KEY, encodeURIComponent(body)))
  }

  takeDraft(): string {
    try {
      if (typeof localStorage === 'undefined') return ''
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
    this.expiresAt = 0
    this.forgetSession()
    removeStored(STORAGE_KEY)
    removeStored(EXPIRES_KEY)
  }

  private isExpired(): boolean {
    return this.expiresAt > 0 && Date.now() >= this.expiresAt
  }

  private setToken(token: string, expiresIn?: number): void {
    this.token = token
    this.expiresAt = expiresIn ? Date.now() + expiresIn * 1000 : 0
    writeStored(STORAGE_KEY, token)
    writeStored(EXPIRES_KEY, String(this.expiresAt))
  }

  private forgetSession(): void {
    this.session = null
    removeStored(SESSION_KEY)
  }
}

function readStored(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string): void {
  trySafe(() => localStorage.setItem(key, value))
}

function removeStored(key: string): void {
  trySafe(() => localStorage.removeItem(key))
}

/**
 * Store a token obtained elsewhere, with no known expiry.
 *
 * Kept for callers that already hold a raw token; the OAuth flow should use
 * `Auth.completeLogin` so the session is retained and renewal stays possible.
 */
export function storeToken(token: string): void {
  writeStored(STORAGE_KEY, token)
}

function trySafe(fn: () => void): void {
  try {
    fn()
  } catch {
    // storage disabled (private mode) — non-fatal
  }
}

export const TOKEN_STORAGE_KEY = STORAGE_KEY
