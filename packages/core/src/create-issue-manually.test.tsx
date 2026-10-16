import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { mount } from './mount'
import type { GitalkOptions } from './types'
import { TOKEN_STORAGE_KEY } from './auth'

/**
 * `createIssueManually` is the v1-compatible opt-in for automatic thread
 * creation. Three semantics are pinned here:
 *
 *   omitted / `true` -> the admin sees the "Init Issue" button and clicks it
 *   `false`          -> an admin's page view creates the thread automatically
 *
 * ...plus the v1 security boundary that a visitor who is not an authenticated
 * admin never creates anything, whatever the option says.
 *
 * The `issues` backend is used because it is the one whose `createThread()`
 * has a REST implementation; the `discussions` error path is covered at the
 * end.
 */
const BASE: GitalkOptions = {
  clientID: 'client-id',
  owner: 'gitalk',
  repo: 'gitalk',
  admin: ['booxood'],
  id: 'page-id',
  backend: 'issues',
  language: 'en'
}

interface Call {
  url: string
  method: string
}

/**
 * Stub the REST surface the issues backend walks when the page has no thread:
 * label lookup -> `[]`, `/user` -> the signed-in visitor, `POST /issues` ->
 * the freshly created thread, then the created issue's comment page.
 *
 * `createDelayMs` holds the creation request open, which gives the widget's
 * intermediate state a chance to render — without it Preact batches the whole
 * auto-create into a single paint and a flash would be invisible to a test.
 */
function stubFetch(login = 'booxood', createDelayMs = 0): Call[] {
  const calls: Call[] = []
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    calls.push({ url, method })

    let body: unknown = {}
    if (method === 'POST' && /\/issues$/.test(url)) {
      if (createDelayMs) await new Promise((r) => setTimeout(r, createDelayMs))
      body = {
        number: 7,
        node_id: 'I_7',
        title: 'page-id',
        html_url: 'https://github.com/gitalk/gitalk/issues/7',
        locked: false,
        labels: []
      }
    } else if (url.includes('/user')) {
      body = { login, avatar_url: 'https://avatars.test/1' }
    } else if (/\/issues\?/.test(url)) {
      // No thread carries this page's label yet.
      body = []
    } else if (url.includes('/comments')) {
      // One comment, so a successful creation is provable from the DOM: an
      // error would leave `.gt-error` and no comment body.
      body = [
        {
          id: 523955,
          node_id: 'n1',
          user: { login: 'booxood', avatar_url: 'https://avatars.test/1', html_url: 'u' },
          body_html: '<p>created thread</p>',
          created_at: new Date().toISOString(),
          html_url: 'h',
          reactions: { total_count: 0, heart: 0 }
        }
      ]
    }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }) as typeof fetch
  return calls
}

/** The thread-creating POSTs, i.e. `createThread()` calls that reached GitHub. */
function creates(calls: Call[]): Call[] {
  return calls.filter((c) => c.method === 'POST' && /\/issues$/.test(c.url))
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

async function waitFor(pred: () => Element | null, timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (pred()) return
    await tick()
  }
  throw new Error('timed out waiting for the widget')
}

describe('createIssueManually', () => {
  let host: HTMLElement
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    render(null, host)
    host.remove()
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  })

  it('leaves the button to the admin when the option is omitted (default manual)', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
    const calls = stubFetch()

    mount(host, { ...BASE })
    await waitFor(() => host.querySelector('.gt-no-init'))

    expect(host.querySelector('.gt-no-init')).toBeTruthy()
    expect(host.querySelector('.gt-btn-init')?.textContent).toContain('Init Issue')
    expect(creates(calls)).toHaveLength(0)
  })

  it('treats createIssueManually: true exactly like the default', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
    const calls = stubFetch()

    mount(host, { ...BASE, createIssueManually: true })
    await waitFor(() => host.querySelector('.gt-no-init'))

    expect(host.querySelector('.gt-btn-init')).toBeTruthy()
    expect(creates(calls)).toHaveLength(0)
  })

  it('auto-creates once for an admin when createIssueManually is false', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
    const calls = stubFetch()

    const widget = mount(host, { ...BASE, createIssueManually: false })
    await waitFor(() => host.querySelector('.gt-comment-body'))

    // v1 behaviour: no click needed. The created thread's comments are on
    // screen and nothing errored on the way there.
    expect(creates(calls)).toHaveLength(1)
    expect(host.querySelector('.gt-error')).toBeNull()
    expect(host.querySelector('.gt-comment-body')?.innerHTML).toContain('created thread')
    expect(host.querySelector('.gt-no-init')).toBeNull()
    expect(host.querySelector('.gt-btn-init')).toBeNull()

    // Re-renders must not start another creation: `update()` redraws the same
    // widget instance, which is what a parent re-render does.
    widget.update({ createIssueManually: false })
    widget.update({ createIssueManually: false })
    await tick()
    await tick()
    expect(creates(calls)).toHaveLength(1)
  })

  it('never renders the "not initialized" block while auto-creating', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
    // Slow the creation down so the in-flight state really renders.
    stubFetch('booxood', 30)

    // Every DOM mutation is sampled, so a flash of the notice or its button —
    // even one frame long — is caught.
    let sawNoInit = false
    let sawInitButton = false
    const observer = new MutationObserver(() => {
      if (host.querySelector('.gt-no-init')) sawNoInit = true
      if (host.querySelector('.gt-btn-init')) sawInitButton = true
    })
    observer.observe(host, { childList: true, subtree: true })

    mount(host, { ...BASE, createIssueManually: false })
    await waitFor(() => host.querySelector('.gt-comment-body'))
    observer.disconnect()

    expect(host.querySelector('.gt-error')).toBeNull()
    expect(sawNoInit).toBe(false)
    expect(sawInitButton).toBe(false)
  })

  it('surfaces a creation failure instead of swallowing it', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
    stubFetch()

    // Discussions have no REST create API, so this exercises the failure
    // branch of the auto-create path end to end.
    mount(host, { ...BASE, backend: 'discussions', createIssueManually: false })
    await waitFor(() => host.querySelector('.gt-error'))

    expect(host.querySelector('.gt-error')?.textContent).toContain('REST write API')
    // The admin is left with the manual escape hatch rather than a dead end.
    expect(host.querySelector('.gt-btn-init')).toBeTruthy()
  })

  it('never creates for a signed-in visitor who is not an admin', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
    const calls = stubFetch('mallory')

    mount(host, { ...BASE, createIssueManually: false })
    await waitFor(() => host.querySelector('.gt-no-init'))

    expect(creates(calls)).toHaveLength(0)
    expect(host.querySelector('.gt-btn-init')).toBeNull()
  })

  it.each([undefined, true, false])(
    'never creates for an anonymous visitor (createIssueManually: %s)',
    async (value) => {
      const calls = stubFetch()

      mount(host, { ...BASE, createIssueManually: value })
      await waitFor(() => host.querySelector('.gt-no-init'))

      expect(creates(calls)).toHaveLength(0)
      expect(host.querySelector('.gt-btn-init')).toBeNull()
      // The login affordance is what an anonymous visitor gets instead.
      expect(host.querySelector('.gt-btn-login')).toBeTruthy()
    }
  )
})
