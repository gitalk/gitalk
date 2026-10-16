import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from './mount'
import type { GitalkOptions } from './types'
import { TOKEN_STORAGE_KEY, storeToken } from './auth'

/**
 * Guards for the comment-ui redesign.
 *
 * The stylesheet is the deliverable here, so it is asserted directly (like
 * bundle.test.ts does for the build): class names user CSS hooks into, the
 * light/dark token contract, and the palette values transcribed from the
 * design reference. The last test pins the DOM hierarchy the CSS assumes.
 */
const CSS = readFileSync(resolve(__dirname, 'styles/index.css'), 'utf8')

/** The declarations of the first `<selector> { ... }` block for `selector`. */
function block(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = CSS.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`no ${selector} block in index.css`)
  return match[1]!
}

function tokens(selector: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of block(selector).split('\n')) {
    const match = line.match(/^\s*(--gt-[a-z0-9-]+)\s*:\s*([^;]+);/)
    if (match) out.set(match[1]!, match[2]!.trim())
  }
  return out
}

const LIGHT = tokens(':root')
const DARK = tokens("[data-theme='dark']")

describe('redesigned stylesheet', () => {
  it('keeps every class name that existing CSS and tests depend on', () => {
    const contract = [
      '.gt-container',
      '.gt-comment',
      '.gt-comment-reply-item',
      '.gt-comment-replies',
      '.gt-comment-body',
      '.gt-comment-username',
      '.gt-comment-header',
      '.gt-comment-content',
      '.gt-comment-avatar',
      '.gt-comment-like',
      '.gt-comment-reply',
      '.gt-comment-admin',
      '.gt-counts',
      '.gt-comments',
      '.gt-comments-null',
      '.gt-comments-controls',
      '.gt-no-init',
      '.gt-error',
      '.gt-btn',
      '.gt-btn-loadmore',
      '.gt-header',
      '.gt-header-textarea',
      '.gt-meta',
      '.gt-user',
      '.gt-copyright',
      '.gt-comment-actions',
      // v2.3 additions: @ mentions, reaction picker, upvote, inline reply,
      // optimistic rows. Same contract — hosts style against these.
      '.gt-editor',
      '.gt-mention-list',
      '.gt-mention-item',
      '.gt-reaction-chip',
      '.gt-reaction-picker',
      '.gt-comment-reactions',
      '.gt-upvote',
      '.gt-notice',
      '.gt-reply-box',
      '.gt-comment--pending',
      '.gt-pending-failure',
      '.gt-pending-body'
    ]
    for (const cls of contract) expect(CSS, `${cls} is missing`).toContain(cls)
  })

  it('keeps the dark theme a token-level override set, not a second stylesheet', () => {
    // Every token the dark theme redefines must exist in the light theme, or
    // the two themes drift apart.
    for (const name of DARK.keys()) {
      expect(LIGHT.has(name), `dark defines undeclared ${name}`).toBe(true)
    }
    // ...and the tokens that actually carry the dark look must be overridden.
    for (const name of [
      '--gt-color-surface',
      '--gt-color-surface-soft',
      '--gt-color-text',
      '--gt-color-text-2',
      '--gt-color-text-3',
      '--gt-color-border',
      '--gt-color-accent',
      '--gt-color-main-soft',
      '--gt-color-reply-line',
      '--gt-shadow-card'
    ]) {
      expect(DARK.has(name), `dark does not override ${name}`).toBe(true)
    }
  })

  it('leaves the brand colour untouched in both themes', () => {
    expect(LIGHT.get('--gt-color-main')).toBe('#1e4fff')
    // Dark mode may lighten brand-*coloured text* via --gt-color-accent, but
    // the brand token itself and its button fill must stay #1E4FFF.
    expect(DARK.has('--gt-color-main')).toBe(false)
    expect(LIGHT.get('--gt-color-accent')).toBe('var(--gt-color-main)')
  })

  it('transcribes the reference palette for light and dark', () => {
    expect(LIGHT.get('--gt-color-surface')).toBe('#ffffff')
    expect(LIGHT.get('--gt-color-surface-soft')).toBe('#f8fafc')
    expect(LIGHT.get('--gt-color-text')).toBe('#0f172a')
    expect(LIGHT.get('--gt-color-text-2')).toBe('#64748b')
    expect(LIGHT.get('--gt-color-text-3')).toBe('#94a3b8')
    expect(LIGHT.get('--gt-color-border')).toBe('#e7ecf3')

    expect(DARK.get('--gt-color-surface')).toBe('#111827')
    expect(DARK.get('--gt-color-surface-soft')).toBe('#0f172a')
    expect(DARK.get('--gt-color-text')).toBe('#e5e7eb')
    expect(DARK.get('--gt-color-text-2')).toBe('#94a3b8')
    expect(DARK.get('--gt-color-text-3')).toBe('#64748b')
    expect(DARK.get('--gt-color-border')).toBe('#1f2a3d')

    // The reply rail is the brand mixed into transparency: 22% light, 32% dark.
    expect(LIGHT.get('--gt-color-reply-line')).toContain('22%')
    expect(DARK.get('--gt-color-reply-line')).toContain('32%')

    // v1's grey comment box is gone on purpose; if it comes back, the flat
    // "rows inside one card" layout has been lost.
    expect(CSS).not.toContain('#f9f9f9')
    expect(LIGHT.get('--gt-color-comment-bg')).toBe('transparent')
  })
})

describe('redesigned comment DOM', () => {
  let host: HTMLElement

  const REST = [
    {
      id: 900,
      node_id: 'n900',
      user: { login: 'alice', avatar_url: 'a', html_url: 'u' },
      body_html: '<p>TOP</p>',
      created_at: new Date(Date.now() - 7200000).toISOString(),
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
      created_at: new Date(Date.now() - 60_000).toISOString(),
      html_url: 'h',
      parent_id: 900,
      child_comment_count: 0,
      reactions: { total_count: 0, heart: 0 }
    }
  ]

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
  })

  afterEach(() => {
    render(null, host)
    host.remove()
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  })

  it('puts the action row under the body and the replies inside the content column', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes('/graphql')
        ? // Cosmetic reads (upvote, per-type reaction state): answer them so the
          // run stays free of handled-failure noise.
          { data: { nodes: [], node: null } }
        : url.includes('/comments')
          ? REST
          : url.includes('/user')
            ? { login: 'alice', avatar_url: 'a' }
            : { number: 442, node_id: 'D442', title: 't', html_url: 'u', locked: false }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }) as typeof fetch

    mount(host, {
      clientID: 'c',
      owner: 'gitalk',
      repo: 'gitalk',
      admin: ['alice'],
      number: 442,
      id: 'p',
      perPage: 10
    } as GitalkOptions)
    await waitFor(() => host.querySelector('.gt-comment-actions'))

    const container = host.querySelector('.gt-container')!
    const comment = container.querySelector('.gt-comments > .gt-comment')!
    const body = comment.querySelector('.gt-comment-body')!
    const actions = comment.querySelector('.gt-comment-actions')!

    // Actions belong below the text (reference .actions), not in the header.
    expect(body.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(comment.querySelector('.gt-comment-header .gt-comment-like')).toBeNull()
    expect(actions.querySelector('.gt-comment-like')).toBeTruthy()
    expect(actions.querySelector('.gt-comment-reply')).toBeTruthy()
    // The reply button carries the reference's visible label, not only an icon.
    expect(actions.querySelector('.gt-comment-reply')?.textContent).toContain('Reply')

    // Replies stay nested in the parent's column (the tinted rail).
    const replies = comment.querySelector('.gt-comment-content > .gt-comment-replies')
    expect(replies).toBeTruthy()
    expect(replies?.querySelectorAll('.gt-comment-reply-item').length).toBe(1)

    // The count header moved above the composer; the copyright is a footer.
    const meta = container.querySelector('.gt-meta')!
    const header = container.querySelector('.gt-header')!
    expect(meta.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelector('.gt-copyright')?.parentElement).toBe(container)
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
