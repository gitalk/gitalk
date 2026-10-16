import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { mount } from './mount'
import type { GitalkOptions } from './types'
import { TOKEN_STORAGE_KEY } from './auth'

/**
 * Inline replies.
 *
 * The reply control used to push the quoted comment into the *main* composer,
 * which lost the connection between the answer and what it answered. It now
 * opens an editor inside the comment, exactly where the design reference puts
 * `.reply-box`, with the same `@` autocomplete as the composer.
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

const THREAD = {
  number: 442,
  node_id: 'D442',
  title: 'demo',
  html_url: 'u',
  locked: false,
  comments: COMMENTS.length
}

describe('inline reply', () => {
  let host: HTMLElement
  let graphql: Array<{ query: string; variables: Record<string, unknown> }>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    graphql = []

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/graphql')) {
        const body = JSON.parse(String(init?.body)) as {
          query: string
          variables: Record<string, unknown>
        }
        graphql.push(body)
        if (body.query.includes('addDiscussionComment')) {
          return json({
            data: {
              addDiscussionComment: {
                comment: {
                  id: 'C_new',
                  databaseId: 555,
                  author: { login: 'me', avatarUrl: 'a', url: 'u' },
                  createdAt: '2024-04-01T00:00:00Z',
                  url: 'h',
                  bodyHTML: `<p>${String(body.variables.body)}</p>`,
                  reactionGroups: []
                }
              }
            }
          })
        }
        return json({ data: {} })
      }
      if (url.includes('/issues/442/comments')) return json(COMMENTS)
      if (url.includes('/issues/442')) return json({ ...THREAD })
      if (url.includes('/comments')) return json(COMMENTS)
      if (url.includes('/user')) return json({ login: 'me', avatar_url: 'a' })
      if (url.includes('/discussions/442')) return json(THREAD)
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

  async function mountWidget(extra: Partial<GitalkOptions> = {}, signedIn = true) {
    if (signedIn) localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
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

  const comments = () => [...host.querySelectorAll('.gt-comments > .gt-comment')] as HTMLElement[]
  const commentByText = (text: string) =>
    comments().find((c) => c.querySelector('.gt-comment-body')?.textContent?.includes(text))!
  const replyButton = (comment: HTMLElement) =>
    comment.querySelector('.gt-comment-reply') as HTMLButtonElement

  it('opens the editor inside the comment instead of the main composer', async () => {
    await mountWidget()
    const [first] = comments()
    replyButton(first!).click()
    await flush()

    const box = first!.querySelector('.gt-reply-box')
    expect(box).toBeTruthy()
    // …inside the comment's own content column.
    expect(first!.querySelector('.gt-comment-content > .gt-reply-box')).toBe(box)
    // The main composer is untouched.
    expect((host.querySelector('.gt-header-textarea') as HTMLTextAreaElement).value).toBe('')
    // The reply button reports the open state.
    expect(replyButton(first!).getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps at most one editor open', async () => {
    await mountWidget()
    const [first, second] = comments()
    replyButton(first!).click()
    await flush()
    replyButton(second!).click()
    await flush()

    expect(host.querySelectorAll('.gt-reply-box')).toHaveLength(1)
    expect(second!.querySelector('.gt-reply-box')).toBeTruthy()
    expect(first!.querySelector('.gt-reply-box')).toBeNull()
    expect(replyButton(second!).getAttribute('aria-expanded')).toBe('true')
  })

  it('closes again on Cancel and on Escape, dropping the draft', async () => {
    await mountWidget()
    const [first] = comments()
    replyButton(first!).click()
    await flush()

    const textarea = first!.querySelector('.gt-reply-textarea') as HTMLTextAreaElement
    textarea.value = 'not sent'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()

    ;(first!.querySelector('.gt-btn-cancel-reply') as HTMLElement).click()
    await flush()
    expect(host.querySelector('.gt-reply-box')).toBeNull()

    // Re-opening starts from an empty draft, and Escape closes it again.
    replyButton(first!).click()
    await flush()
    expect((first!.querySelector('.gt-reply-textarea') as HTMLTextAreaElement).value).toBe('')
    const reopened = first!.querySelector('.gt-reply-textarea') as HTMLTextAreaElement
    reopened.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flush()
    expect(host.querySelector('.gt-reply-box')).toBeNull()
  })

  it('posts with the parent id and shows the reply under its parent', async () => {
    await mountWidget()
    // Comments render newest-first, so pick by content rather than by position.
    const first = commentByText('FIRST')
    replyButton(first).click()
    await flush()

    const textarea = first.querySelector('.gt-reply-textarea') as HTMLTextAreaElement
    textarea.value = 'a threaded answer'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    ;(first.querySelector('.gt-btn-submit-reply') as HTMLElement).click()
    await flush()

    const mutation = graphql.find((g) => g.query.includes('addDiscussionComment'))!
    expect(mutation.variables).toEqual({
      body: 'a threaded answer',
      discussionId: 'D442',
      // The parent's GraphQL node id, resolved from the REST numeric id.
      replyToId: 'n900'
    })

    const replies = commentByText('FIRST').querySelectorAll('.gt-comment-reply-item')
    expect(replies).toHaveLength(1)
    expect(replies[0]!.textContent).toContain('a threaded answer')
    // …and nothing landed under the other comment.
    expect(commentByText('SECOND').querySelectorAll('.gt-comment-reply-item')).toHaveLength(0)
    expect(host.querySelector('.gt-reply-box')).toBeNull()
  })

  it('offers the same @ autocomplete inside the reply editor', async () => {
    await mountWidget()
    const first = commentByText('FIRST')
    replyButton(first).click()
    await flush()

    const textarea = first.querySelector('.gt-reply-textarea') as HTMLTextAreaElement
    textarea.value = '@'
    textarea.setSelectionRange(1, 1)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()

    const list = first.querySelector('.gt-mention-list')
    expect(list).toBeTruthy()
    // The viewer ("me") is excluded; the other two are offered alphabetically.
    expect([...list!.querySelectorAll('.gt-mention-item')].map((i) => i.textContent)).toEqual([
      'alice',
      'bob'
    ])

    // Picking inserts into the *reply* draft, not the main composer.
    ;(list!.querySelector('.gt-mention-item') as HTMLElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    )
    await flush()
    expect(textarea.value).toBe('@alice ')
    expect((host.querySelector('.gt-header-textarea') as HTMLTextAreaElement).value).toBe('')
  })

  it('answers an anonymous click on Reply with a sign-in prompt', async () => {
    await mountWidget({}, false)
    const [first] = comments()
    replyButton(first!).click()
    await flush()
    expect(host.querySelector('.gt-reply-box')).toBeNull()
    expect(host.querySelector('.gt-notice')?.textContent).toContain('Sign in with GitHub to reply')
  })

  it('does not offer replies on the Issues backend, which has no threading', async () => {
    await mountWidget({ backend: 'issues' })
    expect(host.querySelector('.gt-comments > .gt-comment')).toBeTruthy()
    expect(host.querySelector('.gt-comment-reply')).toBeNull()
    expect(host.querySelector('.gt-reply-box')).toBeNull()
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
