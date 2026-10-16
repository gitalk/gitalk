import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { Backend } from './api/backend'
import type { PageOptions } from './api/backend'
import type { BackendContext } from './api/backend'
import { DiscussionsBackend } from './api/discussions'
import { IssuesBackend } from './api/issues'
import { Auth } from './auth'
import { API_VERSION, GITHUB_API, GitalkError, HttpClient, RateLimitError, extractMessage } from './api/client'
import { createTranslator } from './i18n'
import type { BackendKind, GitalkComment, GitalkComment as Comment, GitalkOptions, ThreadInfo } from './types'

interface GitalkState {
  loading: boolean
  ready: boolean
  error: string | null
  rateLimited: boolean
  /** True when the thread does not exist yet (never initialised). */
  missingThread: boolean
  /**
   * True while an admin's thread is being created automatically. Keeps the
   * "not initialized" block — and its button — off screen until the attempt
   * has actually failed.
   */
  creatingThread: boolean
  thread: ThreadInfo | null
  comments: Comment[]
  user: { login: string; avatarUrl: string } | null
  draft: string
  previewing: boolean
  previewHtml: string
  submitting: boolean
  loadingMore: boolean
  hasMore: boolean
}

const DEFAULTS = {
  perPage: 10,
  labels: ['Gitalk'],
  backend: 'discussions' as BackendKind,
  enableHotKey: true,
  distractionFreeMode: false,
  /**
   * Manual by default. v1 treated an omitted `createIssueManually` as
   * "auto-create"; 2.0 inverts that on purpose (see `GitalkOptions`).
   */
  createIssueManually: true
}

function normalizeOptions(raw: GitalkOptions) {
  const id = raw.id ?? window.location.pathname
  return {
    id,
    number: raw.number,
    perPage: raw.pageSize ?? raw.perPage ?? DEFAULTS.perPage,
    labels: raw.labels ?? DEFAULTS.labels,
    backend: raw.backend ?? DEFAULTS.backend,
    title: raw.title ?? document.title,
    body: raw.body ?? `${window.location.href}\n\n${metaDescription()}`,
    category: raw.category,
    createIssueManually: raw.createIssueManually ?? raw.createManually ?? DEFAULTS.createIssueManually,
    enableHotKey: raw.enableHotKey ?? DEFAULTS.enableHotKey,
    distractionFreeMode: raw.distractionFreeMode ?? DEFAULTS.distractionFreeMode,
    admin: raw.admin ?? [],
    updateCountCallback: raw.updateCountCallback,
    proxy: raw.proxy,
    clientID: raw.clientID,
    repo: raw.repo,
    owner: raw.owner
  }
}

function metaDescription(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? ''
}

export function useGitalk(options: GitalkOptions) {
  const opts = useMemo(() => normalizeOptions(options), [options])

  const auth = useMemo(
    () => new Auth({ clientID: opts.clientID, proxy: opts.proxy }),
    [opts.clientID, opts.proxy]
  )

  const [state, setState] = useState<GitalkState>({
    loading: true,
    ready: false,
    error: null,
    rateLimited: false,
    missingThread: false,
    creatingThread: false,
    thread: null,
    comments: [],
    user: null,
    draft: '',
    previewing: false,
    previewHtml: '',
    submitting: false,
    loadingMore: false,
    hasMore: false
  })

  const patch = useCallback((next: Partial<GitalkState>) => {
    setState((prev) => ({ ...prev, ...next }))
  }, [])

  const http = useMemo(
    () => new HttpClient(() => auth.getToken()),
    [auth]
  )

  /**
   * Login of the signed-in viewer, resolved at most once.
   *
   * `undefined` means "not looked up yet", `null` means "anonymous". The
   * cached value keeps the post-load identity call from repeating the
   * `/user` request that the missing-thread path already made.
   */
  const viewerRef = useRef<string | null | undefined>(undefined)

  const resolveViewer = useCallback(async (): Promise<string | null> => {
    if (viewerRef.current !== undefined) return viewerRef.current
    if (!auth.getToken()) {
      viewerRef.current = null
      return null
    }
    const me = await http.get<{ login: string; avatar_url: string }>('/user')
    viewerRef.current = me.login
    patch({ user: { login: me.login, avatarUrl: me.avatar_url } })
    return me.login
  }, [auth, http, patch])

  /**
   * `resolveViewer` for the "no thread on this page yet" branch, where a
   * token that cannot identify the viewer (expired, revoked, flaky network)
   * must not replace the "not initialized" notice with an error page. Read
   * paths already degrade to anonymous in that situation; identity does too.
   */
  const resolveViewerSafely = useCallback(async (): Promise<string | null> => {
    try {
      return await resolveViewer()
    } catch (err) {
      console.warn('gitalk: could not resolve the signed-in user', err)
      return null
    }
  }, [resolveViewer])

  const threadRef = useRef<ThreadInfo | null>(null)
  const commentsRef = useRef<GitalkComment[]>([])
  commentsRef.current = state.comments
  const pageRef = useRef(1)
  const backend = useMemo<Backend>(() => {
    const ctx: BackendContext = {
      http,
      getToken: () => auth.getToken(),
      owner: opts.owner,
      repo: opts.repo,
      getThread: () => threadRef.current,
      term: () => opts.id,
      graphql: (body) => sendGraphql(body, auth)
    }
    return opts.backend === 'issues'
      ? new IssuesBackend(ctx, {
          labels: opts.labels,
          title: opts.title,
          body: opts.body
        })
      : new DiscussionsBackend(ctx, {
          title: opts.title,
          body: opts.body,
          labels: opts.labels,
          category: opts.category
        })
  }, [http, auth, opts.owner, opts.repo, opts.backend, opts.id, opts.labels, opts.title, opts.body, opts.category])

  const t = useMemo(() => createTranslator(options.language ?? navigator.language), [options.language])

  const load = useCallback(
    async (append = false, fresh = false) => {
      // Read the page counter from a ref rather than `state`: the closure
      // would otherwise capture the snapshot from when this callback was
      // created and overwrite updates applied while a request was in flight.
      const nextPage = append ? pageRef.current + 1 : 1

      const result = await backend.getComments({
        first: opts.perPage,
        direction: 'last',
        page: nextPage,
        fresh
      })

      // A page that comes back empty means we have drained the thread; stop
      // advertising "load more" instead of letting the user spin forever.
      const drained = result.comments.length === 0 && append

      // Build the next list once and feed both the render and the count
      // callback from it, so the number reported to `updateCountCallback` can
      // never drift from the number the widget renders.
      const previous = commentsRef.current
      const nextComments = drained
        ? previous
        : append
          ? [...previous, ...result.comments]
          : result.comments

      // Keep the ref authoritative for the *next* load too: two loads queued in
      // the same tick would otherwise both read the last rendered list, and the
      // second would drop the first one's page.
      commentsRef.current = nextComments

      setState((prev) => ({
        ...prev,
        comments: nextComments,
        hasMore: drained ? false : result.hasNextPage,
        loading: false,
        ready: true,
        error: null,
        rateLimited: false
      }))
      if (!drained) pageRef.current = nextPage
      updateCount(opts.updateCountCallback, countLoadedComments(nextComments))
    },
    [backend, opts.perPage, opts.updateCountCallback]
  )

  const createThread = useCallback(async () => {
    patch({ loading: true })
    try {
      const thread = await backend.createThread()
      threadRef.current = thread
      patch({ thread, missingThread: false })
      await load()
    } catch (err) {
      // Never swallowed: a failed creation leaves the "not initialized"
      // notice (and the retry button) in place and puts the reason on screen.
      reportFailure(patch, err)
    }
  }, [backend, load, patch])

  /**
   * Auto-create the thread on behalf of an admin, at most once per widget.
   *
   * "Once" is guaranteed by `autoCreateRef`, not by state: a ref is written
   * synchronously, so any second entry into this path — a duplicated effect
   * under React StrictMode, a re-render, a retry — sees the flag *before* the
   * first `createThread()` call has started. A state flag could not do that,
   * because its write would sit behind an `await` and both runs could get
   * past the check.
   */
  const autoCreateRef = useRef(false)
  const autoCreateThread = useCallback(async () => {
    if (autoCreateRef.current) return
    autoCreateRef.current = true

    // Do not announce "not initialized" only to replace it a tick later:
    // stay in the initializing state (loading) with the no-init block
    // suppressed by `creatingThread`, so the flash and its button never
    // render. `missingThread` is still set, so a failure below lands back on
    // the normal not-initialized UI.
    patch({ missingThread: true, creatingThread: true, ready: false, loading: true, error: null })
    try {
      await createThread()
    } finally {
      patch({ creatingThread: false })
    }
  }, [createThread, patch])

  const init = useCallback(async () => {
    patch({ loading: true, error: null, rateLimited: false })
    try {
      // Complete the OAuth round trip, or renew an expired token, before
      // anything below reads `auth.getToken()`. Both are no-ops for an
      // anonymous visitor.
      const returned = takeSessionFromUrl()
      if (returned) {
        await auth.completeLogin(returned)
      } else if (auth.hasSession() && !auth.getToken()) {
        // Signed in previously, but the token lapsed while the page was away.
        await auth.refresh()
      }

      const thread = await backend.resolveThread({ term: opts.id, number: opts.number })
      threadRef.current = thread

      if (!thread) {
        // No thread yet. Creating one is admin-only (the same boundary v1
        // enforced), and so is the manual "init" button, so the viewer has to
        // be identified even though there is nothing to load. Anonymous
        // visitors get `null` here and can therefore never create.
        const viewer = await resolveViewerSafely()
        if (opts.createIssueManually === false && isAdminLogin(opts.admin, viewer)) {
          await autoCreateThread()
        } else {
          patch({ missingThread: true, creatingThread: false, loading: false, ready: true })
        }
        return
      }

      patch({ thread, missingThread: false })
      await load()

      // Restore a draft saved across the OAuth round trip.
      const draft = consumeReturnedDraft()
      if (draft) patch({ draft })

      await resolveViewer()
    } catch (err) {
      reportFailure(patch, err)
    }
  }, [
    backend,
    opts.id,
    opts.number,
    opts.admin,
    opts.createIssueManually,
    auth,
    load,
    patch,
    resolveViewer,
    resolveViewerSafely,
    autoCreateThread
  ])

  /**
   * One init per widget instance.
   *
   * The empty dependency array already limits the effect, but React's
   * StrictMode deliberately runs effects twice on mount; the ref makes a
   * second pass a no-op instead of a second thread lookup racing the
   * auto-create.
   */
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(() => {
    if (!auth.canLogin()) {
      // Already hidden in the UI; keep this as a hard stop for direct callers.
      patch({
        error: 'Sign-in is unavailable: no `clientID` configured.'
      })
      return
    }
    auth.saveDraft(state.draft)
    window.location.href = auth.loginUrl(window.location.href)
  }, [auth, state.draft, patch])

  const logout = useCallback(() => {
    auth.logout()
    window.location.reload()
  }, [auth])

  const setDraft = useCallback((draft: string) => patch({ draft }), [patch])

  const submit = useCallback(async () => {
    if (!state.draft.trim()) return
    patch({ submitting: true })
    try {
      await backend.addComment(state.draft)
      patch({ draft: '', submitting: false, previewing: false, previewHtml: '' })
      // A plain reload can be answered from the browser's copy of the
      // comments response, which still predates this comment.
      await load(false, true)
    } catch (err) {
      reportFailure(patch, err, { submitting: false })
    }
  }, [backend, load, patch, state.draft])

  const togglePreview = useCallback(async () => {
    if (state.previewing) {
      patch({ previewing: false })
      return
    }
    try {
      const html = await backend.preview(state.draft)
      patch({ previewing: true, previewHtml: html })
    } catch (err) {
      reportFailure(patch, err)
    }
  }, [backend, patch, state.draft, state.previewing])

  const replyTo = useCallback((comment: GitalkComment) => {
    const quoted = comment.bodyHtml
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')
    setState((prev) => ({
      ...prev,
      draft: `${prev.draft}${prev.draft ? '\n' : ''}@${comment.user.login}\n${quoted}\n\n`
    }))
  }, [])

  const toggleReaction = useCallback(
    async (comment: GitalkComment) => {
      try {
        await backend.toggleReaction(
          {
            commentId: comment.id,
            nodeId: comment.nodeId,
            viewerHasReacted: comment.reactions.viewerHasReacted
          },
          'HEART'
        )
        patch({
          comments: state.comments.map((c) =>
            c.id === comment.id
              ? {
                  ...c,
                  reactions: {
                    totalCount: c.reactions.totalCount + (c.reactions.viewerHasReacted ? -1 : 1),
                    viewerHasReacted: !c.reactions.viewerHasReacted
                  }
                }
              : c
          )
        })
      } catch (err) {
        reportFailure(patch, err)
      }
    },
    [backend, patch, state.comments]
  )

  const loadMore = useCallback(async () => {
    patch({ loadingMore: true })
    try {
      await load(true)
    } finally {
      patch({ loadingMore: false })
    }
  }, [load, patch])

  const isAdmin = useMemo(
    () => isAdminLogin(opts.admin, state.user?.login ?? null),
    [state.user, opts.admin]
  )

  return {
    state,
    t,
    actions: {
      login,
      logout,
      setDraft,
      submit,
      togglePreview,
      replyTo,
      toggleReaction,
      loadMore,
      createThread
    },
    meta: {
      owner: opts.owner,
      repo: opts.repo,
      isAdmin,
      supportsPreview: true,
      authenticated: Boolean(auth.getToken()),
      /** False when no clientID is configured: the UI hides login affordances. */
      canLogin: auth.canLogin(),
      proxy: auth.proxy
    }
  }
}

/** Case-insensitive membership test against the configured `admin` list. */
function isAdminLogin(admins: string[], login: string | null): boolean {
  if (!login) return false
  const lower = login.toLowerCase()
  return admins.some((a) => a.toLowerCase() === lower)
}

function updateCount(cb: ((n: number) => void) | undefined, count: number): void {
  if (typeof cb !== 'function') return
  try {
    cb(count)
  } catch (err) {
    console.warn('updateCountCallback threw:', err)
  }
}

/**
 * How many comments the widget has loaded: every top-level comment plus every
 * reply, summed over all pages fetched so far.
 *
 * This is deliberately the SAME metric the UI renders in `.gt-counts`
 * (`widget.tsx`'s `loadedCount`). It used to be `result.comments.length`, which
 * counts only top-level entries and only the page just fetched, so any thread
 * with a reply — or whose comments span more than one page — reported a number
 * smaller than the one on screen. Keep the two definitions in step.
 */
function countLoadedComments(comments: GitalkComment[]): number {
  return comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0)
}

/** The query parameter the worker appends after a successful sign-in. */
const SESSION_PARAM = 'gitalk_session'

/**
 * Take the session the worker handed back, and remove it from the address bar.
 *
 * It is scrubbed immediately so the credential does not survive in history,
 * get copied when the visitor shares the link, or leak through a referrer.
 * The session is useless without the server-side key, but there is no reason
 * to leave it lying around.
 */
function takeSessionFromUrl(): string | null {
  try {
    if (typeof window === 'undefined') return null
    const url = new URL(window.location.href)
    const session = url.searchParams.get(SESSION_PARAM)
    if (!session) return null

    url.searchParams.delete(SESSION_PARAM)
    window.history.replaceState(null, '', url.toString())
    return session
  } catch {
    return null
  }
}

function consumeReturnedDraft(): string {
  try {
    const raw = localStorage.getItem('GT_COMMENT')
    if (raw) {
      localStorage.removeItem('GT_COMMENT')
      return decodeURIComponent(raw)
    }
  } catch {
    // storage unavailable
  }
  return ''
}

function reportFailure(
  patch: (next: Partial<GitalkState>) => void,
  err: unknown,
  extra: Partial<GitalkState> = {}
): void {
  const message =
    err instanceof GitalkError ? err.message : err instanceof Error ? err.message : String(err)
  patch({
    error: message,
    loading: false,
    ready: true,
    rateLimited: err instanceof GitalkError && err.rateLimited,
    ...extra
  })
}

/**
 * Issue a GraphQL request, preferring the configured proxy.
 *
 * Rationale: GraphQL is unreachable anonymously (its unauthenticated limit is
 * literally 0), so without a proxy the widget would be limited to REST's
 * 60/hr-per-IP for reads. The proxy can attach a GitHub App installation token
 * instead, lifting that to 5,000/hr. See docs/tech.md §2.1.
 *
 * Falls back to api.github.com when no proxy is configured, so self-hosters and
 * tests keep working without one.
 */
async function sendGraphql<T>(
  body: { query: string; variables: Record<string, unknown> },
  auth: Auth
): Promise<T> {
  const token = auth.getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const target = auth.proxy
    ? `${auth.proxy.replace(/\/$/, '')}/graphql`
    : `${GITHUB_API}/graphql`

  const response = await fetch(target, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  if (response.status === 429) throw new RateLimitError()
  if (!response.ok) throw new GitalkError(await extractMessage(response), response.status)
  return (await response.json()) as T
}
