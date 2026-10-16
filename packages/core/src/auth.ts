import { GitalkError } from './api/client'

const STORAGE_KEY = 'GT_ACCESS_TOKEN'
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
export const DEFAULT_PROXY = 'https://gitalk-proxy.gitalk.workers.dev'

/** Scope needed to read and write discussions on public repositories. */
const SCOPES = 'public_repo'

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'

export interface AuthOptions {
  clientID: string
  /** Override the token-exchange endpoint (e.g. a self-hosted worker). */
  proxy?: string
}

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

  /**
   * Build the GitHub authorize URL. The redirect target is the token proxy,
   * which completes the exchange away from the browser.
   */
  loginUrl(redirectTo: string): string {
    if (!this.options.clientID) {
      throw new GitalkError(
        '`clientID` is required to sign in. Create a GitHub OAuth Application ' +
          'and pass its client id in the gitalk options.'
      )
    }

    const params = new URLSearchParams({
      client_id: this.options.clientID,
      redirect_uri: this.proxy,
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
    trySafe(() => localStorage.removeItem(STORAGE_KEY))
  }
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
