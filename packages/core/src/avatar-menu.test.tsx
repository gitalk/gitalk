import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { mount } from './mount'
import type { GitalkOptions } from './types'
import { TOKEN_STORAGE_KEY } from './auth'

const OPTIONS: GitalkOptions = {
  clientID: 'client-id',
  repo: 'gitalk',
  owner: 'gitalk',
  admin: ['booxood'],
  id: 'page-id',
  number: 442
}

const COMMENTS = [
  {
    id: 523955,
    node_id: 'MDE3OkRpc2N1c3Npb25Db21tZW50NTIzOTU1',
    user: {
      login: 'bob',
      avatar_url: 'https://avatars.test/bob',
      html_url: 'https://github.com/bob'
    },
    body_html: '<p>hello from bob</p>',
    created_at: new Date(Date.now() - 60_000).toISOString(),
    html_url: 'https://github.com/gitalk/gitalk/discussions/442#discussioncomment-523955',
    parent_id: null,
    child_comment_count: 0,
    reactions: { total_count: 0, heart: 0 }
  }
]

function stubFetch(user: { login: string; name?: string | null; avatar_url: string }) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : String(input)
    if (url.includes('/graphql')) {
      return new Response(JSON.stringify({ data: { nodes: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const body = url.includes('/user')
      ? user
      : url.includes('/comments')
        ? COMMENTS
        : url.includes('/discussions/442')
          ? {
              number: 442,
              node_id: 'D_442',
              title: 'demo',
              html_url: 'https://github.com/gitalk/gitalk/discussions/442',
              locked: false
            }
          : {}
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }) as typeof fetch
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

function triggerOf(host: HTMLElement): HTMLButtonElement {
  return host.querySelector<HTMLButtonElement>('.gt-avatar-trigger')!
}

describe('signed-in account card', () => {
  let host: HTMLElement
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(TOKEN_STORAGE_KEY, 'gho_test-token')
    host = document.createElement('div')
    document.body.appendChild(host)
    stubFetch({ login: 'alice', name: 'Alice Liddell', avatar_url: 'https://avatars.test/alice' })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    render(null, host)
    host.remove()
    localStorage.clear()
  })

  it('opens a compact identity card and closes on a second click', async () => {
    mount(host, OPTIONS)
    await waitFor(() => host.querySelector('.gt-avatar-trigger'))

    const trigger = triggerOf(host)
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.getAttribute('aria-label')).toBe('Account: @alice')
    expect(host.querySelector('.gt-avatar-menu')).toBeNull()

    trigger.click()
    await tick()

    const card = host.querySelector<HTMLElement>('.gt-avatar-menu')!
    expect(card).toBeTruthy()
    expect(card.getAttribute('role')).toBe('dialog')
    expect(card.getAttribute('aria-label')).toBe('Account')
    expect(card.getAttribute('data-align')).toBe('start')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    // One row: avatar, display name over the login, and a single sign-out icon.
    expect(card.querySelectorAll('.gt-avatar-card-avatar')).toHaveLength(1)
    const name = card.querySelector<HTMLElement>('.gt-avatar-card-name')!
    expect(name.textContent).toBe('Alice Liddell')
    expect(name.getAttribute('dir')).toBe('auto')
    const login = card.querySelector<HTMLElement>('.gt-avatar-card-login')!
    expect(login.textContent).toBe('@alice')
    expect(login.getAttribute('dir')).toBe('ltr')
    expect(login.classList.contains('is--secondary')).toBe(true)

    const logout = card.querySelector<HTMLButtonElement>('.gt-avatar-card-logout')!
    expect(logout.getAttribute('aria-label')).toBe('Logout')
    expect(logout.getAttribute('title')).toBe('Logout')
    // No navigation items, separators or profile links: this card only
    // confirms identity and offers the way out.
    expect(card.querySelectorAll('a')).toHaveLength(0)
    expect(card.querySelectorAll('hr, [role="separator"]')).toHaveLength(0)

    // Opening moves focus into the card.
    expect(document.activeElement).toBe(card)

    trigger.click()
    await tick()

    expect(host.querySelector('.gt-avatar-menu')).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('falls back to the login when GitHub reports no display name', async () => {
    stubFetch({ login: 'alice', name: null, avatar_url: 'https://avatars.test/alice' })
    mount(host, OPTIONS)
    await waitFor(() => host.querySelector('.gt-avatar-trigger'))

    triggerOf(host).click()
    await tick()

    const card = host.querySelector<HTMLElement>('.gt-avatar-menu')!
    expect(card.querySelector('.gt-avatar-card-name')).toBeNull()
    const login = card.querySelector<HTMLElement>('.gt-avatar-card-login')!
    expect(login.textContent).toBe('@alice')
    expect(login.classList.contains('is--secondary')).toBe(false)
  })

  it('closes on Escape and gives focus back to the avatar button', async () => {
    mount(host, OPTIONS)
    await waitFor(() => host.querySelector('.gt-avatar-trigger'))

    const trigger = triggerOf(host)
    trigger.click()
    await tick()
    expect(host.querySelector('.gt-avatar-menu')).toBeTruthy()
    expect(document.activeElement).not.toBe(trigger)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await tick()

    expect(host.querySelector('.gt-avatar-menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('closes when the pointer lands outside the card', async () => {
    mount(host, OPTIONS)
    await waitFor(() => host.querySelector('.gt-avatar-trigger'))

    triggerOf(host).click()
    await tick()
    expect(host.querySelector('.gt-avatar-menu')).toBeTruthy()

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await tick()
    expect(host.querySelector('.gt-avatar-menu')).toBeNull()
  })

  it('signs out in place: session storage cleared, avatar and composer identity gone', async () => {
    localStorage.setItem('GT_SESSION', 'sealed-session')
    localStorage.setItem('GT_TOKEN_EXPIRES_AT', String(Date.now() + 60_000))

    mount(host, OPTIONS)
    await waitFor(() => host.querySelector('.gt-avatar-trigger'))

    // Signed in: the composer shows the avatar, not the sign-in prompt.
    expect(host.querySelector('.gt-header-avatar')).toBeTruthy()
    expect(host.querySelector('.gt-composer-login')).toBeNull()

    triggerOf(host).click()
    await tick()
    host.querySelector<HTMLButtonElement>('.gt-avatar-card-logout')!.click()
    await tick()

    // Back to the signed-out composer; no card, no avatar, no identity row.
    expect(host.querySelector('.gt-avatar-menu')).toBeNull()
    expect(host.querySelector('.gt-avatar-trigger')).toBeNull()
    expect(host.querySelector('.gt-header-avatar')).toBeNull()
    expect(host.querySelector('.gt-avatar-card-login')).toBeNull()
    expect(host.querySelector('.gt-composer-login')).toBeTruthy()
    expect(host.textContent).not.toContain('@alice')

    // Token, session and expiry are gone; the draft is not a credential and
    // may stay. GitHub's revoke endpoint is never called (no such fetch).
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem('GT_SESSION')).toBeNull()
    expect(localStorage.getItem('GT_TOKEN_EXPIRES_AT')).toBeNull()
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
    expect(calls.some((call) => String(call[0]).includes('revoke'))).toBe(false)
  })

  it('mirrors the card in RTL: explicit dir, end-edge alignment and avatar on the right', async () => {
    mount(host, { ...OPTIONS, language: 'fa' })
    await waitFor(() => host.querySelector('.gt-avatar-trigger'))

    const trigger = triggerOf(host)
    // jsdom has no layout, so hand the component the rect it would get from
    // a composer avatar near the right edge of a 1024px viewport.
    trigger.getBoundingClientRect = () =>
      ({
        left: 700,
        right: 730,
        top: 700,
        bottom: 730,
        width: 30,
        height: 30,
        x: 700,
        y: 700,
        toJSON: () => ({})
      }) as DOMRect

    trigger.click()
    await tick()
    await tick()

    const card = host.querySelector<HTMLElement>('.gt-avatar-menu')!
    expect(card).toBeTruthy()
    expect(card.getAttribute('dir')).toBe('rtl')
    expect(card.getAttribute('data-align')).toBe('end')
    expect(card.getAttribute('data-placement')).toBe('up')

    // The card grows leftwards from the avatar's right edge and stays on
    // screen: 730 - 260 = 470.
    expect(card.style.left).toBe('470px')

    // DOM order is avatar -> user -> logout; `dir="rtl"` puts the avatar on
    // the right and the sign-out icon on the left. The login stays pinned LTR.
    expect(card.querySelector('.gt-avatar-card-login')!.getAttribute('dir')).toBe('ltr')
    expect(card.querySelector('.gt-avatar-card-name')!.getAttribute('dir')).toBe('auto')
  })

  it('keeps the card inside the viewport when the avatar is near an edge', async () => {
    mount(host, OPTIONS)
    await waitFor(() => host.querySelector('.gt-avatar-trigger'))

    const trigger = triggerOf(host)
    trigger.getBoundingClientRect = () =>
      ({
        left: 1000,
        right: 1030,
        top: 40,
        bottom: 70,
        width: 30,
        height: 30,
        x: 1000,
        y: 40,
        toJSON: () => ({})
      }) as DOMRect

    trigger.click()
    await tick()
    await tick()

    const card = host.querySelector<HTMLElement>('.gt-avatar-menu')!
    // 1024 viewport, 260 card, 8px edge -> 756px is the furthest right it
    // may start. Below-placement is clamped just as it is for `left`.
    expect(card.style.left).toBe('756px')
    expect(parseInt(card.style.top, 10)).toBeGreaterThanOrEqual(8)
  })
})
