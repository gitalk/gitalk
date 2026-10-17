import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from './mount'
import type { GitalkOptions } from './types'
import { TOKEN_STORAGE_KEY } from './auth'
import { dockGeometry, shouldDock } from './use-sticky-composer'

const CSS = readFileSync(resolve(__dirname, 'styles/index.css'), 'utf8')

describe('new interaction states are backed by CSS', () => {
  it('ships the collapse, dock and preview rules', () => {
    // Without these the classes the widget toggles would render nothing.
    expect(CSS).toContain('.gt-container.gt-minimized > :not(.gt-fab)')
    expect(CSS).toMatch(/\.gt-container \.gt-header\.is--docked \{[^}]*position: fixed/s)
    expect(CSS).toContain('.gt-container .gt-header-placeholder')
    expect(CSS).toContain('.gt-container .gt-composer-preview')
    expect(CSS).toContain('.gt-container .gt-composer-body')
    expect(CSS).toContain('.gt-container .gt-btn-preview-toggle')
    expect(CSS).toContain('.gt-container .gt-fab--bottom-right')
    expect(CSS).toContain('.gt-container .gt-fab--top-left')
  })
})

/**
 * v2.4 interaction surface:
 *
 *  - collapse the widget into a floating action button,
 *  - cap (or uncap) the scrolling comment list,
 *  - dock the composer to the viewport bottom,
 *  - open the floating Markdown preview.
 *
 * The pure dock maths is tested directly; the rest goes through the real
 * widget so the option plumbing, accessibility attributes and DOM contract
 * are all exercised together.
 */
const COMMENTS = [
  {
    id: 900,
    node_id: 'n900',
    user: { login: 'alice', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>FIRST</p>',
    created_at: '2024-02-01T00:00:00Z',
    html_url: 'h',
    parent_id: null,
    child_comment_count: 1,
    reactions: { total_count: 2, heart: 2 }
  },
  {
    id: 901,
    node_id: 'n901',
    user: { login: 'bob', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>REPLY</p>',
    created_at: '2024-03-01T00:00:00Z',
    html_url: 'h',
    parent_id: 900,
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

describe('collapse to a floating button', () => {
  let host: HTMLElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    render(null, host)
    host.remove()
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  })

  it('starts expanded with a minimise control and no floating button', async () => {
    await mountWidget(host)

    expect(host.querySelector('.gt-minimize')).toBeTruthy()
    expect(host.querySelector('.gt-fab')).toBeNull()
    expect(host.querySelector('.gt-container')?.classList.contains('gt-minimized')).toBe(false)
    expect(host.querySelector('.gt-comments')).toBeTruthy()
  })

  it('collapses into a bottom-right FAB and restores on click', async () => {
    await mountWidget(host)

    ;(host.querySelector('.gt-minimize') as HTMLButtonElement).click()
    await flush()

    const container = host.querySelector('.gt-container')!
    const fab = host.querySelector('.gt-fab') as HTMLButtonElement
    expect(container.classList.contains('gt-minimized')).toBe(true)
    expect(container.getAttribute('data-minimized')).toBe('true')
    expect(fab).toBeTruthy()
    expect(fab.classList.contains('gt-fab--bottom-right')).toBe(true)
    expect(fab.getAttribute('aria-label')).toBe('Open comments')
    // One top-level comment plus one reply.
    expect(fab.querySelector('.gt-fab-count')?.textContent).toBe('2')
    // The comments are still in the DOM (so expanding does not refetch) but
    // the container class is what hides them.
    expect(host.querySelector('.gt-comments')).toBeTruthy()

    fab.click()
    await flush()

    expect(host.querySelector('.gt-fab')).toBeNull()
    expect(container.classList.contains('gt-minimized')).toBe(false)
    expect(container.hasAttribute('data-minimized')).toBe(false)
  })

  it('parks the FAB in the configured corner', async () => {
    await mountWidget(host, { fabPosition: 'top-left' })

    ;(host.querySelector('.gt-minimize') as HTMLButtonElement).click()
    await flush()

    const fab = host.querySelector('.gt-fab')!
    expect(fab.classList.contains('gt-fab--top-left')).toBe(true)
    expect(fab.classList.contains('gt-fab--bottom-right')).toBe(false)
  })

  it('can be switched off entirely', async () => {
    await mountWidget(host, { minimizable: false })

    expect(host.querySelector('.gt-minimize')).toBeNull()
    ;(host.querySelector('.gt-container') as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    )
    await flush()
    expect(host.querySelector('.gt-fab')).toBeNull()
    expect(host.querySelector('.gt-container')?.classList.contains('gt-minimized')).toBe(false)
  })
})

describe('configurable comment-list height', () => {
  let host: HTMLElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    render(null, host)
    host.remove()
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  })

  const comments = () => host.querySelector('.gt-comments') as HTMLElement

  it('uses the design reference demo height and scrolls inside the list by default', async () => {
    await mountWidget(host)

    // jsdom's CSS parser drops the nested `calc()`; browsers keep the authored
    // value. Assert the parts that matter, not the serialisation.
    expect(comments().style.maxHeight).toContain('700px')
    expect(comments().style.maxHeight).toContain('100dvh')
    expect(comments().style.overflowY).toBe('auto')
  })

  it('accepts a pixel cap from the host', async () => {
    await mountWidget(host, { maxHeight: 420 })

    expect(comments().style.maxHeight).toBe('420px')
    expect(comments().style.overflowY).toBe('auto')
  })

  it('accepts any CSS length expression', async () => {
    await mountWidget(host, { maxHeight: '60vh' })

    expect(comments().style.maxHeight).toBe('60vh')
  })

  it('removes the cap entirely with null', async () => {
    await mountWidget(host, { maxHeight: null })

    expect(comments().style.maxHeight).toBe('')
    expect(comments().style.overflowY).toBe('')
  })
})

describe('design-reference layout', () => {
  let host: HTMLElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    render(null, host)
    host.remove()
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  })

  it('puts the composer under the list, with source and preview in one body', async () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
    await mountWidget(host)

    const list = host.querySelector('.gt-comments')!
    const composer = host.querySelector('.gt-header')!
    expect(
      list.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    // One body owns both states; there is no second floating panel.
    const body = composer.querySelector('.gt-composer-body')
    expect(body).toBeTruthy()
    expect(body?.querySelector('.gt-header-textarea')).toBeTruthy()
    expect(composer.querySelector('.composer-preview')).toBeNull()
  })
})

describe('sticky composer geometry', () => {
  it('docks when the widget bottom reaches the viewport bottom', () => {
    expect(shouldDock({ top: 100, bottom: 800 }, 800, false)).toBe(true)
    expect(shouldDock({ top: 100, bottom: 700 }, 800, false)).toBe(false)
  })

  it('keeps the widget alone when it is scrolled out of view', () => {
    expect(shouldDock({ top: -900, bottom: -100 }, 800, false)).toBe(false)
    expect(shouldDock({ top: 900, bottom: 1200 }, 800, false)).toBe(false)
  })

  it('applies hysteresis so a docked composer does not flicker at the edge', () => {
    // Still docked 5px above the fold...
    expect(shouldDock({ top: 100, bottom: 795 }, 800, true)).toBe(true)
    // ...but released once it clears the edge by more than the hysteresis.
    expect(shouldDock({ top: 100, bottom: 790 }, 800, true)).toBe(false)
  })

  it('aligns the fixed composer with the widget column and clamps to the viewport', () => {
    expect(dockGeometry({ left: 100, width: 600 }, 1000)).toEqual({ left: 112, width: 576 })
    expect(dockGeometry({ left: 0, width: 300 }, 320)).toEqual({ left: 12, width: 276 })
    // Too narrow for two 12px gutters plus the 220px minimum: use the full
    // width that is left instead of overflowing.
    expect(dockGeometry({ left: 0, width: 150 }, 320)).toEqual({ left: 12, width: 220 })
  })
})

describe('sticky composer through the widget', () => {
  let host: HTMLElement

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
  })

  afterEach(() => {
    render(null, host)
    host.remove()
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  })

  it('docks the composer, reserves its space and undocks when the widget clears', async () => {
    await mountWidget(host)

    const container = host.querySelector('.gt-container') as HTMLElement
    const composer = host.querySelector('.gt-header') as HTMLElement
    const viewportBottom = window.innerHeight

    mockRect(container, {
      top: 100,
      bottom: viewportBottom + 20,
      left: 50,
      width: 600,
      height: viewportBottom + 20 - 100
    })
    mockRect(composer, { height: 180 })

    window.dispatchEvent(new Event('scroll'))
    await flush(80)

    expect(composer.classList.contains('is--docked')).toBe(true)
    expect(composer.getAttribute('data-docked')).toBe('true')
    expect(composer.style.left).toBe('62px')
    expect(composer.style.width).toBe('576px')
    const placeholder = host.querySelector('.gt-header-placeholder') as HTMLElement | null
    expect(placeholder).toBeTruthy()
    expect(placeholder!.style.height).toBe('180px')

    // Scroll further: the widget is entirely above the viewport, so the
    // composer returns to the document flow.
    mockRect(container, { top: -700, bottom: -100, left: 50, width: 600, height: 600 })
    window.dispatchEvent(new Event('scroll'))
    await flush(80)

    expect(composer.classList.contains('is--docked')).toBe(false)
    expect(composer.style.left).toBe('')
    expect(host.querySelector('.gt-header-placeholder')).toBeNull()
  })

  it('leaves the composer in the flow when stickyComposer is false', async () => {
    await mountWidget(host, { stickyComposer: false })

    const container = host.querySelector('.gt-container') as HTMLElement
    const composer = host.querySelector('.gt-header') as HTMLElement
    mockRect(container, {
      top: 100,
      bottom: window.innerHeight + 20,
      left: 50,
      width: 600,
      height: window.innerHeight - 80
    })
    mockRect(composer, { height: 180 })

    window.dispatchEvent(new Event('scroll'))
    await flush(80)

    expect(composer.classList.contains('is--docked')).toBe(false)
    expect(host.querySelector('.gt-header-placeholder')).toBeNull()
  })
})

describe('manual Markdown preview inside the composer', () => {
  let host: HTMLElement
  let markdownCalls: string[]

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    markdownCalls = []
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
  })

  afterEach(() => {
    render(null, host)
    host.remove()
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  })

  const toggle = () => host.querySelector('.gt-btn-preview-toggle') as HTMLButtonElement
  const preview = () => host.querySelector('.gt-composer-preview') as HTMLElement | null

  it('opens only when the toggle is clicked, calls backend.preview() once and returns to source', async () => {
    await mountWidget(host)

    expect(toggle()).toBeTruthy()
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
    expect(preview()).toBeNull()

    await typeDraft(host, '**bold**')

    // Nothing watches the draft: no debounce, no request while typing.
    expect(markdownCalls).toEqual([])
    await flush(450)
    expect(markdownCalls).toEqual([])
    expect(preview()).toBeNull()

    toggle().click()
    await waitFor(() => preview())

    expect(markdownCalls).toEqual(['**bold**'])
    expect(host.querySelector('.gt-composer-body')?.classList.contains('is--preview')).toBe(true)
    expect(toggle().getAttribute('aria-pressed')).toBe('true')
    expect(preview()?.querySelector('.preview-label')?.textContent).toBe('Preview')
    expect(preview()?.querySelector('.preview-body')?.innerHTML).toContain('<strong>bold</strong>')
    // The draft is preserved; only the view changed.
    expect((host.querySelector('.gt-header-textarea') as HTMLTextAreaElement).value).toBe('**bold**')

    // Toggle back: source returns without another request.
    toggle().click()
    await waitFor(() => (preview() ? null : true))
    expect(preview()).toBeNull()
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
    expect(markdownCalls).toEqual(['**bold**'])

    // A new draft is rendered by the next explicit toggle.
    await typeDraft(host, '**bold** and *new*')
    toggle().click()
    await waitFor(
      () => (preview()?.querySelector('.preview-body')?.innerHTML.includes('<em>new</em>') ?? false),
      1200
    )
    expect(markdownCalls).toEqual(['**bold**', '**bold** and *new*'])
    expect(toggle().getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps a single-row editor with a placeholder', async () => {
    await mountWidget(host)

    const textarea = host.querySelector('.gt-header-textarea') as HTMLTextAreaElement
    expect(textarea.getAttribute('rows')).toBe('1')
    expect(textarea.getAttribute('placeholder')).toBe('Write a comment…')
    expect(textarea.value).toBe('')
  })

  it('grows (and shrinks) the editor with the draft', async () => {
    await mountWidget(host)
    const textarea = host.querySelector('.gt-header-textarea') as HTMLTextAreaElement

    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 120 })
    textarea.value = 'line one\nline two\nline three'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    expect(textarea.style.height).toBe('120px')

    Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 36 })
    textarea.value = 'one line'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    expect(textarea.style.height).toBe('36px')
  })

  it('has no legacy floating preview and no "Markdown is supported" hint', async () => {
    await mountWidget(host)

    expect(host.querySelector('.gt-btn-preview')).toBeNull()
    expect(host.querySelector('.composer-preview')).toBeNull()
    expect(host.querySelector('.gt-header-controls-tip')).toBeNull()
    expect(host.textContent).not.toContain('Markdown is supported')
    // The icon-only toggle still carries an accessible name.
    expect(toggle().getAttribute('aria-label')).toBe('Preview')
  })

  it('disables the toggle while the draft is empty', async () => {
    await mountWidget(host)

    expect(toggle().disabled).toBe(true)
    toggle().click()
    await flush()
    expect(markdownCalls).toEqual([])
    expect(preview()).toBeNull()
  })

  it('closes the preview when the widget collapses and does not reopen it automatically', async () => {
    await mountWidget(host)

    await typeDraft(host, 'hello')
    toggle().click()
    await waitFor(() => preview())

    ;(host.querySelector('.gt-minimize') as HTMLButtonElement).click()
    await flush()
    expect(preview()).toBeNull()

    ;(host.querySelector('.gt-fab') as HTMLButtonElement).click()
    await flush(450)
    // Manual means manual: expanding keeps source mode until asked again.
    expect(preview()).toBeNull()
    expect((host.querySelector('.gt-header-textarea') as HTMLTextAreaElement).value).toBe('hello')

    toggle().click()
    await waitFor(() => preview())
    expect(markdownCalls).toEqual(['hello', 'hello'])
  })

  async function mountWidget(target: HTMLElement, extra: Partial<GitalkOptions> = {}) {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/markdown')) {
        const body = JSON.parse(String(init?.body)) as { text: string }
        markdownCalls.push(body.text)
        return new Response(`<p>${renderMarkdownStub(body.text)}</p>`, {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        })
      }
      if (url.includes('/comments')) return json(COMMENTS)
      if (url.includes('/discussions/442')) return json(THREAD)
      if (url.includes('/graphql')) return json({ data: { nodes: [], node: null } })
      if (url.includes('/user')) return json({ login: 'alice', avatar_url: 'a' })
      return json({})
    }) as typeof fetch

    mount(target, {
      clientID: 'c',
      owner: 'gitalk',
      repo: 'gitalk',
      admin: [],
      number: 442,
      id: 'p',
      perPage: 10,
      ...extra
    } as GitalkOptions)
    await waitFor(() => target.querySelector('.gt-comment'))
  }

  async function typeDraft(target: HTMLElement, value: string) {
    const textarea = target.querySelector('.gt-header-textarea') as HTMLTextAreaElement
    textarea.value = value
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush(30)
  }
})

/** Minimal Markdown rendering that preserves the tags these tests assert on. */
function renderMarkdownStub(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

async function mountWidget(host: HTMLElement, extra: Partial<GitalkOptions> = {}) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/comments')) return json(COMMENTS)
    if (url.includes('/discussions/442')) return json(THREAD)
    if (url.includes('/graphql')) return json({ data: { nodes: [], node: null } })
    if (url.includes('/user')) return json({ login: 'alice', avatar_url: 'a' })
    return json({})
  }) as typeof fetch

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
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

function mockRect(el: Element, rect: Partial<DOMRect>) {
  const value = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => value,
    ...rect
  } as DOMRect
  Object.defineProperty(el, 'getBoundingClientRect', {
    configurable: true,
    value: () => value
  })
}

function flush(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(pred: () => unknown, timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (pred()) return
    await flush(10)
  }
  throw new Error('timed out waiting for the widget')
}
