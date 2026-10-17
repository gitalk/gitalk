import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from './mount'
import type { GitalkOptions } from './types'
import { TOKEN_STORAGE_KEY } from './auth'

/**
 * Optimistic posting: the three paths that matter.
 *
 *  1. **insert** — the comment shows up before GitHub has answered;
 *  2. **replace** — the server's row takes its place, exactly once, with no
 *     duplicate and no flicker of the wrong order;
 *  3. **rollback** — a refusal leaves a clearly-marked failure (red border,
 *     reason, retry/discard) rather than a comment that looks posted.
 *
 * With `prefers-reduced-motion: reduce` the "breathing" cue is switched off.
 */
const THREAD = {
  number: 442,
  node_id: 'D442',
  title: 'demo',
  html_url: 'u',
  locked: false,
  comments: 2
}

/** One REST comment row, as the widget will receive it. */
interface RawRow {
  id: number
  node_id: string
  user: { login: string; avatar_url: string; html_url: string }
  body_html: string
  created_at: string
  html_url: string
  parent_id: number | null
  child_comment_count: number
  reactions: Record<string, number>
}

const BASE_COMMENTS: RawRow[] = [
  {
    id: 900,
    node_id: 'n900',
    user: { login: 'alice', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>FIRST</p>',
    created_at: '2024-02-01T00:00:00Z',
    html_url: 'h',
    parent_id: null,
    child_comment_count: 0,
    reactions: { total_count: 0, heart: 0 }
  },
  {
    id: 901,
    node_id: 'n901',
    user: { login: 'bob', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>SECOND</p>',
    created_at: '2024-03-01T00:00:00Z',
    html_url: 'h',
    parent_id: null,
    child_comment_count: 0,
    reactions: { total_count: 0, heart: 0 }
  }
]

describe('optimistic comment posting', () => {
  let host: HTMLElement
  /** What the server would return for the comments endpoint right now. */
  let serverComments: RawRow[]
  /** GraphQL requests that have not been answered yet. */
  let inFlight: Array<{ body: { query: string; variables: Record<string, unknown> }; resolve: (r: Response) => void }>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    serverComments = [...BASE_COMMENTS]
    inFlight = []
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/graphql')) {
        const body = JSON.parse(String(init?.body)) as {
          query: string
          variables: Record<string, unknown>
        }
        // Reaction-state hydration is fire-and-forget and must not be confused
        // with the write the test controls.
        if (body.query.includes('gitalkReactionStates')) {
          return json({ data: { nodes: [] } })
        }
        // Deliberately left hanging until the test settles it, so the window
        // between "submitted" and "confirmed" can be inspected.
        return await new Promise<Response>((resolvePromise) =>
          inFlight.push({ body, resolve: resolvePromise })
        )
      }
      if (url.includes('/user')) return json({ login: 'me', avatar_url: 'a' })
      if (url.includes('/comments')) return json(serverComments)
      if (url.includes('/discussions/442')) {
        return json({ ...THREAD, comments: serverComments.length })
      }
      return json({})
    }) as typeof fetch
  })

  afterEach(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    globalThis.fetch = originalFetch
    render(null, host)
    host.remove()
  })

  function json(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  async function mountWidget() {
    mount(host, {
      clientID: 'c',
      owner: 'gitalk',
      repo: 'gitalk',
      admin: [],
      number: 442,
      id: 'p',
      perPage: 10,
      // Keeps the extra upvote query out of the picture.
      upvote: false
    } as GitalkOptions)
    await waitFor(() => host.querySelector('.gt-comment'))
  }

  /** Type a draft and press Comment. */
  async function post(body: string) {
    const textarea = host.querySelector('.gt-header-textarea') as HTMLTextAreaElement
    textarea.value = body
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    ;(host.querySelector('.gt-btn-public') as HTMLButtonElement).click()
    await flush()
  }

  /** Answer every queued GraphQL request, and publish the new comment. */
  async function confirmNextComment(body: string, id: number, parentId: number | null) {
    const queued = inFlight.splice(0)
    for (const request of queued) {
      request.resolve(
        json({
          data: {
            addDiscussionComment: {
              comment: {
                id: `C_${id}`,
                databaseId: id,
                author: { login: 'me', avatarUrl: 'a', url: 'u' },
                createdAt: '2024-04-01T00:00:00Z',
                url: 'h',
                bodyHTML: `<p>${body}</p>`,
                reactionGroups: []
              }
            }
          }
        })
      )
      // The server now holds it, in the ascending order the API returns.
      serverComments = [
        ...serverComments,
        {
          id,
          node_id: `n${id}`,
          user: { login: 'me', avatar_url: 'a', html_url: 'u' },
          body_html: `<p>${body}</p>`,
          created_at: '2024-04-01T00:00:00Z',
          html_url: 'h',
          parent_id: parentId,
          child_comment_count: 0,
          reactions: { total_count: 0, heart: 0 }
        }
      ]
    }
    await flush()
  }

  async function failNextComment(message: string, status = 500) {
    const queued = inFlight.splice(0)
    for (const request of queued) {
      request.resolve(new Response(JSON.stringify({ message }), { status }))
    }
    await flush()
  }

  const pendingRows = () => [...host.querySelectorAll('.gt-comment--pending')] as HTMLElement[]

  it('inserts the comment immediately, before GitHub has answered', async () => {
    await mountWidget()
    await post('hello world')

    const rows = pendingRows()
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.classList.contains('is--sending')).toBe(true)
    expect(row.getAttribute('aria-busy')).toBe('true')
    expect(row.textContent).toContain('hello world')
    expect(row.textContent).toContain('Sending…')
    // It is a comment row, at the top of the list, in the right place.
    expect(row.parentElement?.classList.contains('gt-comments')).toBe(true)
    expect(host.querySelector('.gt-comments > .gt-comment--pending')).toBeTruthy()

    // The composer cleared at once, and the pending row is not counted yet.
    expect((host.querySelector('.gt-header-textarea') as HTMLTextAreaElement).value).toBe('')
    expect(host.querySelector('.gt-counts')?.textContent).toContain('2')

    // Nothing else claims the comment exists.
    expect(host.querySelectorAll('.gt-comments > .gt-comment:not(.gt-comment--pending)')).toHaveLength(2)
  })

  it('replaces the optimistic row with the server row, exactly once', async () => {
    await mountWidget()
    await post('hello world')
    await confirmNextComment('hello world', 1000, null)

    expect(pendingRows()).toHaveLength(0)
    // Newest first: the confirmed comment is at the top of the list.
    const top = host.querySelector('.gt-comments > .gt-comment')!
    expect(top.classList.contains('gt-comment--pending')).toBe(false)
    expect(top.querySelector('.gt-comment-body')?.innerHTML).toContain('<p>hello world</p>')
    // Not twice, and not next to a leftover optimistic copy.
    expect(host.querySelectorAll('.gt-comment-body')).toHaveLength(3)
    expect([...host.querySelectorAll('.gt-comment-body')].filter((b) => b.textContent === 'hello world')).toHaveLength(1)
    expect(host.querySelector('.gt-counts')?.textContent).toContain('3')
  })

  it('rolls back on failure, marking the row instead of pretending it posted', async () => {
    await mountWidget()
    await post('doomed comment')
    await failNextComment('GitHub refused this comment')

    const rows = pendingRows()
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.classList.contains('is--failed')).toBe(true)
    expect(row.classList.contains('is--sending')).toBe(false)
    expect(row.getAttribute('aria-busy')).toBe('false')
    expect(row.textContent).toContain('Not posted')
    // The reason is readable, and it is the author's row that is flagged.
    expect(row.querySelector('.gt-pending-failure')?.getAttribute('role')).toBe('alert')
    expect(row.textContent).toContain('GitHub refused this comment')
    // It never became a real comment.
    expect(host.querySelectorAll('.gt-comments > .gt-comment:not(.gt-comment--pending)')).toHaveLength(2)
    expect(host.querySelector('.gt-counts')?.textContent).toContain('2')

    // Retrying posts it: the failure turns into the confirmed comment.
    ;(row.querySelector('.gt-pending-retry') as HTMLElement).click()
    await flush()
    expect(pendingRows()[0]!.classList.contains('is--sending')).toBe(true)
    await confirmNextComment('doomed comment', 1001, null)
    expect(pendingRows()).toHaveLength(0)
    expect(host.textContent).toContain('doomed comment')
  })

  it('lets the author discard a failed comment', async () => {
    await mountWidget()
    await post('never mind')
    await failNextComment('nope')
    ;(pendingRows()[0]!.querySelector('.gt-pending-discard') as HTMLElement).click()
    await flush()
    expect(pendingRows()).toHaveLength(0)
    expect(host.textContent).not.toContain('never mind')
  })

  it('posts replies optimistically too, inside their parent', async () => {
    await mountWidget()
    const parent = [...host.querySelectorAll('.gt-comments > .gt-comment')].find((c) =>
      c.querySelector('.gt-comment-body')?.textContent?.includes('FIRST')
    )!
    ;(parent.querySelector('.gt-comment-reply') as HTMLElement).click()
    await flush()

    const textarea = parent.querySelector('.gt-reply-textarea') as HTMLTextAreaElement
    textarea.value = 'optimistic reply'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    ;(parent.querySelector('.gt-btn-submit-reply') as HTMLElement).click()
    await flush()

    const pending = parent.querySelector('.gt-comment-replies .gt-comment--pending')
    expect(pending).toBeTruthy()
    expect(pending!.textContent).toContain('optimistic reply')
    expect(pending!.getAttribute('aria-busy')).toBe('true')

    await confirmNextComment('optimistic reply', 1002, 900)
    expect(host.querySelector('.gt-comment--pending')).toBeNull()
    const replies = parent.querySelectorAll('.gt-comment-reply-item')
    expect(replies).toHaveLength(1)
    expect(replies[0]!.textContent).toContain('optimistic reply')
  })

  it('switches the breathing cue off under prefers-reduced-motion', () => {
    const css = readFileSync(resolve(__dirname, 'styles/index.css'), 'utf8')
    expect(css).toContain('@keyframes gt-kf-breathe')
    // There is more than one reduced-motion block (the init logo has its own);
    // the one under test is the one that mentions the pending row.
    const blocks = [
      ...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/g)
    ].map((match) => match[1]!)
    const block = blocks.find((text) => text.includes('.gt-comment--pending'))
    expect(block).toBeTruthy()
    expect(block).toContain('animation: none')
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
