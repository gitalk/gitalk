import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { mount } from './mount'
import type { GitalkOptions } from './types'
import { TOKEN_STORAGE_KEY } from './auth'

/**
 * `@` autocomplete through the real widget: the popup is driven by the
 * caret, filters as you type, and inserts at the cursor rather than at the end.
 *
 * Every interaction is followed by {@link flush}: Preact schedules renders
 * outside the event handler, so the DOM is only guaranteed to be up to date
 * after the browser has had a frame.
 */
const COMMENTS = [
  {
    id: 1,
    node_id: 'n1',
    user: { login: 'alice', avatar_url: 'a1', html_url: 'u1' },
    body_html: '<p>first</p>',
    created_at: '2024-01-01T00:00:00Z',
    html_url: 'h',
    parent_id: null,
    child_comment_count: 1,
    reactions: { total_count: 0, heart: 0 }
  },
  {
    id: 2,
    node_id: 'n2',
    user: { login: 'bob', avatar_url: 'a2', html_url: 'u2' },
    body_html: '<p>second</p>',
    created_at: '2024-02-01T00:00:00Z',
    html_url: 'h',
    parent_id: null,
    child_comment_count: 0,
    reactions: { total_count: 0, heart: 0 }
  },
  {
    id: 3,
    node_id: 'n3',
    user: { login: 'carol', avatar_url: 'a3', html_url: 'u3' },
    body_html: '<p>a reply</p>',
    created_at: '2024-03-01T00:00:00Z',
    html_url: 'h',
    parent_id: 1,
    child_comment_count: 0,
    reactions: { total_count: 0, heart: 0 }
  }
]

const THREAD = {
  number: 442,
  node_id: 'D442',
  title: 'demo',
  html_url: 'u',
  locked: false,
  comments: COMMENTS.length
}

describe('@ mention autocomplete', () => {
  let host: HTMLElement
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes('/graphql')
        ? // The upvote and reaction-state reads are cosmetic; answer them so the
          // suite does not log their (handled) failures.
          { data: { nodes: [], node: null } }
        : url.includes('/comments')
          ? COMMENTS
          : url.includes('/user')
            ? { login: 'alice', avatar_url: 'a1' }
            : url.includes('/discussions/442')
              ? THREAD
              : {}
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }) as typeof fetch
  })

  afterEach(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    globalThis.fetch = originalFetch
    render(null, host)
    host.remove()
  })

  async function mountWidget(extra: Partial<GitalkOptions> = {}): Promise<HTMLTextAreaElement> {
    mount(host, {
      clientID: 'c',
      owner: 'gitalk',
      repo: 'gitalk',
      admin: [],
      number: 442,
      id: 'p',
      perPage: 10,
      ...extra
    } as GitalkOptions)
    await waitFor(() => host.querySelector('.gt-comment'))
    return host.querySelector('.gt-header-textarea')!
  }

  /** Type into the textarea the way a browser would, caret included. */
  async function type(el: HTMLTextAreaElement, value: string, caret = value.length) {
    el.value = value
    el.setSelectionRange(caret, caret)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
  }

  async function key(el: HTMLElement, name: string) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))
    el.dispatchEvent(new KeyboardEvent('keyup', { key: name, bubbles: true }))
    await flush()
  }

  function rows(): HTMLElement[] {
    return [...host.querySelectorAll('.gt-mention-item')] as HTMLElement[]
  }

  it('offers the discussion participants, minus the viewer, when @ is typed', async () => {
    const el = await mountWidget()
    await type(el, '@')

    expect(host.querySelector('.gt-mention-list')).toBeTruthy()
    // alice is signed in, so only bob and carol are offered — and carol only
    // wrote a reply, which still makes her a participant.
    expect(rows().map((r) => r.textContent)).toEqual(['bob', 'carol'])
  })

  it('exposes the listbox to assistive technology and toggles aria-expanded', async () => {
    const el = await mountWidget()
    expect(el.getAttribute('aria-expanded')).toBe('false')

    await type(el, '@bo')
    expect(el.getAttribute('role')).toBe('combobox')
    expect(el.getAttribute('aria-expanded')).toBe('true')

    const list = host.querySelector('.gt-mention-list')!
    expect(list.getAttribute('role')).toBe('listbox')
    expect(el.getAttribute('aria-controls')).toBe(list.id)

    const active = el.getAttribute('aria-activedescendant')!
    expect(active).toBe(`${list.id}-0`)
    const option = host.querySelector(`#${active}`)!
    expect(option.getAttribute('role')).toBe('option')
    expect(option.getAttribute('aria-selected')).toBe('true')
  })

  it('filters as more of the login is typed', async () => {
    const el = await mountWidget()
    await type(el, '@b')
    expect(rows().map((r) => r.textContent)).toEqual(['bob'])

    await type(el, '@c')
    expect(rows().map((r) => r.textContent)).toEqual(['carol'])

    // No candidate: the popup closes rather than showing an empty box.
    await type(el, '@zzz')
    expect(host.querySelector('.gt-mention-list')).toBeNull()
    expect(el.getAttribute('aria-expanded')).toBe('false')
  })

  it('does not open for an @ inside a word', async () => {
    const el = await mountWidget()
    await type(el, 'mail me at bob@example')
    expect(host.querySelector('.gt-mention-list')).toBeNull()
  })

  it('inserts the picked login at the caret, not at the end of the draft', async () => {
    const el = await mountWidget()
    // Caret sits right after the "@": "…and some trailing text" follows it.
    await type(el, '@ and some trailing text', 1)
    expect(rows().map((r) => r.textContent)).toEqual(['bob', 'carol'])

    await key(el, 'ArrowDown')
    const highlighted = el.getAttribute('aria-activedescendant')!
    expect(host.querySelector(`#${highlighted}`)?.textContent).toBe('carol')

    await key(el, 'ArrowUp')
    await key(el, 'Enter')

    expect(el.value).toBe('@bob  and some trailing text')
    expect(el.selectionStart).toBe('@bob '.length)
    expect(host.querySelector('.gt-mention-list')).toBeNull()
  })

  it('wraps around the list when arrowing past either end', async () => {
    const el = await mountWidget()
    await type(el, '@')
    expect(rows()).toHaveLength(2)

    await key(el, 'ArrowUp') // from the first row up to the last
    expect(el.getAttribute('aria-activedescendant')).toContain('-1')
  })

  it('confirms the highlighted candidate with Tab and with a mouse click', async () => {
    const el = await mountWidget()
    await type(el, 'hi @c')
    await key(el, 'Tab')
    expect(el.value).toBe('hi @carol ')

    await type(el, 'hi @b')
    rows()[0]!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flush()
    expect(el.value).toBe('hi @bob ')
  })

  it('closes on Escape without touching the draft', async () => {
    const el = await mountWidget()
    await type(el, '@b')
    await key(el, 'Escape')
    expect(host.querySelector('.gt-mention-list')).toBeNull()
    expect(el.value).toBe('@b')
  })

  it('closes when the click lands outside the editor', async () => {
    const el = await mountWidget()
    await type(el, '@b')
    expect(host.querySelector('.gt-mention-list')).toBeTruthy()

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await flush()
    expect(host.querySelector('.gt-mention-list')).toBeNull()
    expect(el.value).toBe('@b')
  })

  it('can be switched off with mentions: false', async () => {
    const el = await mountWidget({ mentions: false })
    await type(el, '@')
    expect(host.querySelector('.gt-mention-list')).toBeNull()
  })
})

async function waitFor(pred: () => Element | null, timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (pred()) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('timed out waiting for widget')
}

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 25))
}
