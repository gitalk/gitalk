import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { mount } from './mount'
import type { GitalkOptions } from './types'
import { TOKEN_STORAGE_KEY } from './auth'

/**
 * Reactions and upvotes, aligned with what GitHub Discussions actually offers:
 *
 *  - **reactions** belong to one comment, and there are eight of them, each
 *    with its own count and its own viewer flag;
 *  - **upvotes** belong to the discussion itself and exist on Discussions only.
 *
 * The old single heart (labelled "Like", read as a favourite) is gone; these
 * tests pin its replacement, the per-type counts, and the anonymous path.
 */
const COMMENTS = [
  {
    id: 900,
    node_id: 'n900',
    user: { login: 'alice', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>TOP</p>',
    created_at: '2024-02-01T00:00:00Z',
    html_url: 'h',
    parent_id: null,
    child_comment_count: 0,
    // A real REST payload: every type has its own key.
    reactions: { total_count: 4, '+1': 1, '-1': 0, laugh: 0, hooray: 0, confused: 0, heart: 2, rocket: 1, eyes: 0 }
  }
]

const THREAD = {
  number: 442,
  // Next-generation global id, the format GitHub returns when the
  // `X-Github-Next-Global-ID: 1` opt-in header is sent. The legacy format is
  // `MDEwOkRpc2N1c3Npb24zMjg4OTM2` (decodes to `010:Discussion3288936`).
  node_id: 'D_kwDOBctmZs4AMi9o',
  title: 'demo',
  html_url: 'u',
  locked: false,
  comments: COMMENTS.length
}

interface Harness {
  host: HTMLElement
  graphql: Array<{ query: string; variables: Record<string, unknown> }>
  graphqlHeaders: Array<Record<string, string>>
  restRequests: Array<{ url: string; headers: Record<string, string> }>
}

describe('reactions and upvotes', () => {
  let host: HTMLElement
  let graphql: Harness['graphql']
  let graphqlHeaders: Harness['graphqlHeaders']
  let restRequests: Harness['restRequests']
  /** What the `gitalkReactionStates` query answers with. */
  let reactionStates: Array<{ id: string; reactionGroups: unknown[] }>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    graphql = []
    graphqlHeaders = []
    restRequests = []
    reactionStates = []

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const headers = { ...((init?.headers as Record<string, string> | undefined) ?? {}) }
      if (url.includes('/graphql')) {
        const body = JSON.parse(String(init?.body)) as {
          query: string
          variables: Record<string, unknown>
        }
        graphql.push(body)
        graphqlHeaders.push(headers)
        if (body.query.includes('upvoteCount')) {
          return json({ data: { node: { upvoteCount: 5, viewerHasUpvoted: false } } })
        }
        if (body.query.includes('gitalkReactionStates')) {
          return json({ data: { nodes: reactionStates } })
        }
        return json({ data: {} })
      }
      restRequests.push({ url, headers })
      if (url.includes('/issues/442/comments')) return json(COMMENTS)
      if (url.includes('/issues/442')) {
        return json({ ...THREAD, number: 442 })
      }
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

  async function mountWidget(extra: Partial<GitalkOptions> = {}, signedIn: boolean | string = true) {
    if (signedIn) {
      localStorage.setItem(TOKEN_STORAGE_KEY, typeof signedIn === 'string' ? signedIn : 'test-token')
    }
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

  const option = (label: string) =>
    host.querySelector(`.gt-reaction-option[title="${label}"]`) as HTMLElement | null

  it('replaces the heart/favourite button with a real reaction control', async () => {
    await mountWidget()

    // The old control: a heart glyph titled "Like". It must be gone.
    expect(host.querySelector('.gt-ico-heart')).toBeNull()
    expect(host.querySelector('[title="Like"]')).toBeNull()

    const actions = host.querySelector('.gt-comment-actions')!
    const trigger = actions.querySelector('.gt-comment-like') as HTMLElement
    expect(trigger).toBeTruthy()
    expect(trigger.getAttribute('aria-label')).toBe('Add reaction')
    expect(trigger.getAttribute('aria-haspopup')).toBe('listbox')
  })

  it('shows a chip per used reaction type, with the counts from the API', async () => {
    await mountWidget()
    const chips = [...host.querySelectorAll('.gt-reaction-chip')]
    expect(chips.map((c) => c.textContent)).toEqual(['👍1', '❤️2', '🚀1'])
    // Nothing has been picked by this viewer yet.
    expect(chips.every((c) => c.getAttribute('aria-pressed') === 'false')).toBe(true)
  })

  it('offers all eight GitHub reaction types in the picker', async () => {
    await mountWidget()
    ;(host.querySelector('.gt-reaction-trigger') as HTMLElement).click()
    await flush()

    const options = [...host.querySelectorAll('.gt-reaction-option')]
    expect(options.map((o) => o.getAttribute('title'))).toEqual([
      'Thumbs up',
      'Thumbs down',
      'Laugh',
      'Hooray',
      'Confused',
      'Heart',
      'Rocket',
      'Eyes'
    ])
  })

  it('restores the viewer\u2019s own picks from GraphQL, which REST cannot report', async () => {
    // The REST payload in COMMENTS says nothing about who reacted, so without
    // this hydration a reload would silently drop the highlight.
    reactionStates = [
      {
        id: 'n900',
        reactionGroups: [
          { content: 'HEART', viewerHasReacted: true, reactors: { totalCount: 3 } },
          { content: 'ROCKET', viewerHasReacted: false, reactors: { totalCount: 1 } }
        ]
      }
    ]
    await mountWidget()
    await flush()

    const chips = [...host.querySelectorAll('.gt-reaction-chip')]
    // Server counts replace the REST ones, and the heart is marked as mine.
    expect(chips.map((c) => c.textContent)).toEqual(['❤️3', '🚀1'])
    expect(chips[0]!.getAttribute('aria-pressed')).toBe('true')
    expect(chips[1]!.getAttribute('aria-pressed')).toBe('false')

    const query = graphql.find((g) => g.query.includes('gitalkReactionStates'))!
    expect(query.variables).toEqual({ ids: ['n900'] })
    expect(query.query).toContain('... on Reactable')
    expect(query.query).toContain('viewerHasReacted')
  })

  it('adds the picked reaction on the comment node id and highlights it', async () => {
    await mountWidget()
    ;(host.querySelector('.gt-reaction-trigger') as HTMLElement).click()
    await flush()
    option('Rocket')!.click()
    await flush()

    const mutation = graphql.find((g) => g.query.includes('addReaction'))!
    expect(mutation.variables).toMatchObject({ subjectId: 'n900', content: 'ROCKET' })

    const rocket = [...host.querySelectorAll('.gt-reaction-chip')].find((c) =>
      c.textContent?.includes('🚀')
    )!
    expect(rocket.getAttribute('aria-pressed')).toBe('true')
    expect(rocket.textContent).toBe('🚀2')
    // The picker closes on pick.
    expect(host.querySelector('.gt-reaction-picker')).toBeNull()
  })

  it('removes a reaction the viewer already holds, and rolls the count back on failure', async () => {
    await mountWidget()
    ;(host.querySelector('.gt-reaction-trigger') as HTMLElement).click()
    await flush()
    option('Rocket')!.click()
    await flush()
    // Toggle it off again.
    const chip = [...host.querySelectorAll('.gt-reaction-chip')].find((c) =>
      c.textContent?.includes('🚀')
    )!
    ;(chip as HTMLElement).click()
    await flush()
    expect(graphql.some((g) => g.query.includes('removeReaction'))).toBe(true)

    // Now make GitHub refuse: the optimistic highlight has to come back off.
    const failing = [...host.querySelectorAll('.gt-reaction-chip')].find((c) =>
      c.textContent?.includes('🚀')
    )!
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/graphql') ? new Response('{"message":"boom"}', { status: 500 }) : json(COMMENTS)
    ) as typeof fetch
    ;(failing as HTMLElement).click()
    await flush()
    const after = [...host.querySelectorAll('.gt-reaction-chip')].find((c) =>
      c.textContent?.includes('🚀')
    )!
    expect(after.getAttribute('aria-pressed')).toBe('false')
    expect(host.querySelector('.gt-error')).toBeTruthy()
  })

  it('hides reactions when the host switches them off', async () => {
    await mountWidget({ reactions: false })
    expect(host.querySelector('.gt-comment-reactions')).toBeNull()
    expect(host.querySelector('.gt-reaction-trigger')).toBeNull()
    // The reply control is unaffected: the option only covers reactions.
    expect(host.querySelector('.gt-comment-reply')).toBeTruthy()
  })

  it('renders a discussion-level upvote with the count, and toggles it', async () => {
    await mountWidget()
    const upvote = host.querySelector('.gt-upvote') as HTMLButtonElement
    expect(upvote).toBeTruthy()
    expect(upvote.textContent).toContain('Upvote')
    expect(upvote.textContent).toContain('5')
    expect(upvote.disabled).toBe(false)
    expect(upvote.getAttribute('aria-pressed')).toBe('false')

    upvote.click()
    await flush()
    const add = graphql.find((g) => g.query.includes('addUpvote'))!
    expect(add).toBeTruthy()
    // The id GitHub is given must be the next-generation format, not the
    // legacy `010:Discussion…` string that triggered the DEPRECATION warning.
    expect(add.variables).toEqual({ subjectId: 'D_kwDOBctmZs4AMi9o' })
    expect(upvote.getAttribute('aria-pressed')).toBe('true')
    expect(upvote.textContent).toContain('6')

    upvote.click()
    await flush()
    const remove = graphql.find((g) => g.query.includes('removeUpvote'))!
    expect(remove.variables).toEqual({ subjectId: 'D_kwDOBctmZs4AMi9o' })
    expect(upvote.getAttribute('aria-pressed')).toBe('false')
    expect(upvote.textContent).toContain('5')
  })

  it('asks GitHub for upvote state with the documented Discussion fields', async () => {
    await mountWidget()
    const query = graphql.find((g) => g.query.includes('upvoteCount'))!
    expect(query.query).toContain('viewerHasUpvoted')
    expect(query.variables).toEqual({ id: 'D_kwDOBctmZs4AMi9o' })
  })

  it('opts REST and GraphQL into next-generation global node ids', async () => {
    await mountWidget()
    // REST is where the widget gets the discussion/comment ids it later sends
    // to GraphQL; without this header they come back in the legacy format.
    const rest = restRequests.find((r) => r.url.includes('/discussions/442'))!
    expect(rest.headers['X-Github-Next-Global-ID']).toBe('1')

    // GraphQL must opt in too, so ids in its *responses* (a new comment, a
    // repository id used by createDiscussion) are new-format as well.
    expect(graphqlHeaders.length).toBeGreaterThan(0)
    for (const headers of graphqlHeaders) {
      expect(headers['X-Github-Next-Global-ID']).toBe('1')
    }
  })

  it('disables upvote for GitHub App user tokens instead of letting GitHub reject it', async () => {
    // GitHub App user-to-server tokens (`ghu_`) cannot call addUpvote even
    // with `Discussions: write`; the count is still readable.
    await mountWidget({}, 'ghu_test')
    const upvote = host.querySelector('.gt-upvote') as HTMLButtonElement
    expect(upvote).toBeTruthy()
    expect(upvote.disabled).toBe(true)
    expect(upvote.title).toContain('GitHub App')
    expect(upvote.textContent).toContain('5')

    upvote.click()
    await flush()
    expect(graphql.some((g) => g.query.includes('addUpvote'))).toBe(false)
    expect(host.querySelector('.gt-error')).toBeNull()
  })

  it('does not render the upvote control on the Issues backend', async () => {
    // Issues have no upvote concept at all; the widget must degrade quietly.
    await mountWidget({ backend: 'issues' })
    expect(host.querySelector('.gt-upvote')).toBeNull()
    expect(host.querySelector('.gt-comment')).toBeTruthy()
    expect(graphql.some((g) => g.query.includes('upvoteCount'))).toBe(false)
  })

  it('answers an anonymous click with a sign-in prompt instead of failing silently', async () => {
    await mountWidget({}, false)
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull()

    const trigger = host.querySelector('.gt-reaction-trigger') as HTMLElement
    trigger.click()
    await flush()

    const notice = host.querySelector('.gt-notice')!
    expect(notice).toBeTruthy()
    expect(notice.getAttribute('role')).toBe('status')
    expect(notice.textContent).toContain('Sign in with GitHub to react')
    expect(notice.querySelector('.gt-btn-notice-login')).toBeTruthy()
    // Nothing was sent to GitHub: anonymous GraphQL would only 403.
    expect(graphql).toHaveLength(0)

    // Dismissable.
    ;(notice.querySelector('.gt-notice-close') as HTMLElement).click()
    await flush()
    expect(host.querySelector('.gt-notice')).toBeNull()
  })

  it('does not render an upvote control an anonymous visitor could never use', async () => {
    // The widget's only sign-in path mints a GitHub App user token, which
    // GitHub forbids from upvoting — so there is no login that would enable
    // this control. Showing it would be a promise the API cannot keep.
    await mountWidget({}, false)
    expect(host.querySelector('.gt-upvote')).toBeNull()
    expect(graphql).toHaveLength(0)
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
