import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exchangeCodeForToken, getLoginUrl, getStoredToken, storeToken, clearToken } from './auth'
import { GT_ACCESS_TOKEN } from '../const'

describe('auth', () => {
  describe('token storage', () => {
    afterEach(() => window.localStorage.clear())

    it('stores, reads and clears token', () => {
      expect(getStoredToken()).toBeNull()
      storeToken('tok-1')
      expect(window.localStorage.getItem(GT_ACCESS_TOKEN)).toBe('tok-1')
      expect(getStoredToken()).toBe('tok-1')
      clearToken()
      expect(getStoredToken()).toBeNull()
    })
  })

  describe('getLoginUrl', () => {
    it('builds github authorize url', () => {
      const url = getLoginUrl('client-1', 'https://example.com/post/1')
      expect(url).toContain('https://github.com/login/oauth/authorize?')
      expect(url).toContain('client_id=client-1')
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fpost%2F1')
      expect(url).toContain('scope=public_repo')
    })
  })

  describe('exchangeCodeForToken', () => {
    const mockFetch = vi.fn()
    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch)
      mockFetch.mockReset()
    })
    afterEach(() => vi.unstubAllGlobals())

    it('posts credentials to proxy and returns access_token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'at-1' }),
      })

      const token = await exchangeCodeForToken({
        proxy: 'https://proxy.example.com/token',
        code: 'code-1',
        clientID: 'cid',
        clientSecret: 'sec',
      })

      expect(token).toBe('at-1')
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe('https://proxy.example.com/token')
      expect(JSON.parse(init.body)).toEqual({
        code: 'code-1',
        client_id: 'cid',
        client_secret: 'sec',
      })
    })

    it('rejects when response has no access_token', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => ({ error: 'bad_code' }) })
      await expect(
        exchangeCodeForToken({ proxy: 'p', code: 'c', clientID: 'i', clientSecret: 's' })
      ).rejects.toThrow('no access token')
    })

    it('rejects on http failure', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
      await expect(
        exchangeCodeForToken({ proxy: 'p', code: 'c', clientID: 'i', clientSecret: 's' })
      ).rejects.toThrow('OAuth token request failed')
    })
  })
})
