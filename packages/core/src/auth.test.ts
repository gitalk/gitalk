import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { Auth, DEFAULT_PROXY } from './auth'
import { GitalkError } from './api/client'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

describe('Auth', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('does not throw when no proxy is configured — it falls back to the default', () => {
    const auth = new Auth({ clientID: 'cid' })
    expect(auth.proxy).toBe(DEFAULT_PROXY)
    expect(() => auth.loginUrl('https://example.com/post')).not.toThrow()
  })

  it('reports canLogin=false without a clientID so the UI can hide the button', () => {
    expect(new Auth({ clientID: '' }).canLogin()).toBe(false)
    expect(new Auth({ clientID: 'cid' }).canLogin()).toBe(true)
  })

  it('still throws a clear error if loginUrl is called without a clientID', () => {
    expect(() => new Auth({ clientID: '' }).loginUrl('https://x')).toThrow(GitalkError)
  })

  describe('loginUrl', () => {
    it('points at the worker, not at GitHub', () => {
      const auth = new Auth({ clientID: 'cid', proxy: 'https://my-worker.example' })
      const url = new URL(auth.loginUrl('https://example.com/post'))

      // The worker builds the GitHub URL and the `state`; doing it here too
      // would let the redirect target drift out of sync with /oauth/callback.
      expect(url.origin + url.pathname).toBe('https://my-worker.example/oauth/authorize')
      expect(url.searchParams.get('return_to')).toBe('https://example.com/post')
    })

    it('never sends a scope, which a GitHub App would ignore', () => {
      const auth = new Auth({ clientID: 'cid', proxy: 'https://my-worker.example' })
      expect(auth.loginUrl('https://example.com')).not.toContain('scope=')
    })

    it('tolerates a proxy configured with a trailing slash', () => {
      const auth = new Auth({ clientID: 'cid', proxy: 'https://my-worker.example/' })
      // A naive join would produce `//oauth/authorize` and 404 on the worker.
      const url = new URL(auth.loginUrl('https://example.com'))
      expect(url.origin + url.pathname).toBe('https://my-worker.example/oauth/authorize')
    })
  })

  describe('session handling', () => {
    it('exchanges a returned session for a token and remembers it', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ access_token: 'tok-1' }))
      vi.stubGlobal('fetch', fetchMock)

      const auth = new Auth({ clientID: 'cid', proxy: 'https://w.example' })
      expect(await auth.completeLogin('sealed-session')).toBe(true)

      expect(auth.getToken()).toBe('tok-1')
      expect(auth.hasSession()).toBe(true)
      expect(localStorage.getItem('GT_SESSION')).toBe('sealed-session')
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://w.example/oauth/token')
    })

    it('replaces the stored session when the worker rotates it', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ access_token: 'tok-1', session: 'rotated' }))
      )

      const auth = new Auth({ clientID: 'cid', proxy: 'https://w.example' })
      await auth.completeLogin('original')

      expect(localStorage.getItem('GT_SESSION')).toBe('rotated')
    })

    it('keeps the refreshed token with its expiry so it can be renewed later', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ access_token: 'tok-1', expires_in: 3600 }))
      )

      const auth = new Auth({ clientID: 'cid', proxy: 'https://w.example' })
      await auth.completeLogin('sealed')

      const expiresAt = Number(localStorage.getItem('GT_TOKEN_EXPIRES_AT'))
      expect(expiresAt).toBeGreaterThan(Date.now())
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + 3600 * 1000)
    })

    it('forgets a session the worker rejects, rather than retrying it forever', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'nope' }, 401)))

      const auth = new Auth({ clientID: 'cid', proxy: 'https://w.example' })
      expect(await auth.completeLogin('stale')).toBe(false)
      expect(auth.hasSession()).toBe(false)
      expect(localStorage.getItem('GT_SESSION')).toBeNull()
      expect(auth.isAuthenticated()).toBe(false)
    })

    it('keeps the session when the request fails for network reasons', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      const auth = new Auth({ clientID: 'cid', proxy: 'https://w.example' })
      expect(await auth.completeLogin('sealed')).toBe(false)
      // A transient failure is not proof the credential is dead.
      expect(auth.hasSession()).toBe(true)
    })

    it('refuses to refresh with no session at all', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      expect(await new Auth({ clientID: 'cid' }).refresh()).toBe(false)
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  describe('expiry', () => {
    it('hides an expired token so reads fall back to anonymous', () => {
      localStorage.setItem('GT_ACCESS_TOKEN', 'tok')
      localStorage.setItem('GT_TOKEN_EXPIRES_AT', String(Date.now() - 1000))

      const auth = new Auth({ clientID: 'cid' })
      // Returning it would only produce 401s from GitHub.
      expect(auth.getToken()).toBeNull()
      expect(auth.isAuthenticated()).toBe(false)
    })

    it('keeps a token that has not expired', () => {
      localStorage.setItem('GT_ACCESS_TOKEN', 'tok')
      localStorage.setItem('GT_TOKEN_EXPIRES_AT', String(Date.now() + 60_000))

      expect(new Auth({ clientID: 'cid' }).getToken()).toBe('tok')
    })

    it('treats a missing expiry as never expiring', () => {
      localStorage.setItem('GT_ACCESS_TOKEN', 'tok')
      expect(new Auth({ clientID: 'cid' }).getToken()).toBe('tok')
    })
  })

  describe('token kind', () => {
    it('recognizes GitHub App user-to-server tokens by their documented prefix', () => {
      localStorage.setItem('GT_ACCESS_TOKEN', 'ghu_app-token')
      expect(new Auth({ clientID: 'cid' }).isAppUserToken()).toBe(true)
    })

    it('does not mistake OAuth App or personal access tokens for App tokens', () => {
      // These are the token kinds for which addUpvote is known to work, so the
      // upvote control must stay enabled.
      for (const token of ['gho_oauth', 'ghp_classic', 'github_pat_fine', 'test-token']) {
        localStorage.setItem('GT_ACCESS_TOKEN', token)
        expect(new Auth({ clientID: 'cid' }).isAppUserToken()).toBe(false)
      }
    })

    it('is false without a token, including an expired one', () => {
      expect(new Auth({ clientID: 'cid' }).isAppUserToken()).toBe(false)

      localStorage.setItem('GT_ACCESS_TOKEN', 'ghu_expired')
      localStorage.setItem('GT_TOKEN_EXPIRES_AT', String(Date.now() - 1000))
      expect(new Auth({ clientID: 'cid' }).isAppUserToken()).toBe(false)
    })
  })

  it('round-trips a draft through storage', () => {
    const auth = new Auth({ clientID: 'cid' })
    auth.saveDraft('hello world')
    expect(auth.takeDraft()).toBe('hello world')
    // draft is consumed, not replayed
    expect(auth.takeDraft()).toBe('')
  })

  it('survives storage being unavailable (private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded')
    })
    const auth = new Auth({ clientID: 'cid' })
    expect(() => auth.saveDraft('x')).not.toThrow()
    spy.mockRestore()
  })

  it('clears both the token and the session on logout', () => {
    localStorage.setItem('GT_ACCESS_TOKEN', 'tok')
    localStorage.setItem('GT_SESSION', 'sealed')
    localStorage.setItem('GT_TOKEN_EXPIRES_AT', String(Date.now() + 60_000))

    const auth = new Auth({ clientID: 'cid' })
    expect(auth.isAuthenticated()).toBe(true)

    auth.logout()
    expect(auth.isAuthenticated()).toBe(false)
    // Leaving the session behind would silently sign the user back in.
    expect(auth.hasSession()).toBe(false)
    expect(localStorage.getItem('GT_ACCESS_TOKEN')).toBeNull()
    expect(localStorage.getItem('GT_SESSION')).toBeNull()
    expect(localStorage.getItem('GT_TOKEN_EXPIRES_AT')).toBeNull()
  })
})
