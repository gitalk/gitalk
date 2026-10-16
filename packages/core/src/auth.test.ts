import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { Auth, DEFAULT_PROXY } from './auth'
import { GitalkError } from './api/client'

describe('Auth', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('does not throw when no proxy is configured — it falls back to the default', () => {
    const auth = new Auth({ clientID: 'cid' })
    expect(auth.proxy).toBe(DEFAULT_PROXY)
    expect(() => auth.loginUrl('https://example.com/post')).not.toThrow()
  })

  it('honours an explicit proxy override for self-hosters', () => {
    const auth = new Auth({ clientID: 'cid', proxy: 'https://my-worker.example' })
    expect(auth.proxy).toBe('https://my-worker.example')
    const url = auth.loginUrl('https://example.com/post')
    expect(url).toContain('redirect_uri=https%3A%2F%2Fmy-worker.example')
  })

  it('reports canLogin=false without a clientID so the UI can hide the button', () => {
    expect(new Auth({ clientID: '' }).canLogin()).toBe(false)
    expect(new Auth({ clientID: 'cid' }).canLogin()).toBe(true)
  })

  it('still throws a clear error if loginUrl is called without a clientID', () => {
    expect(() => new Auth({ clientID: '' }).loginUrl('https://x')).toThrow(GitalkError)
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

  it('clears the token on logout', () => {
    localStorage.setItem('GT_ACCESS_TOKEN', 'tok')
    const auth = new Auth({ clientID: 'cid' })
    expect(auth.isAuthenticated()).toBe(true)
    auth.logout()
    expect(auth.isAuthenticated()).toBe(false)
    expect(localStorage.getItem('GT_ACCESS_TOKEN')).toBeNull()
  })
})
