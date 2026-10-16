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
  distractionFreeMode: false
}

function normalizeOptions(raw: GitalkOptions) {
  const id = raw.id ?? window.location.pathname
  return {
    id,
    number: raw.number,
    perPage: raw.perPage ?? DEFAULTS.perPage,
    labels: raw.labels ?? DEFAULTS.labels,
    backend: raw.backend ?? DEFAULTS.backend,
    title: raw.title ?? document.title,
    body: raw.body ?? `${window.location.href}\n\n${metaDescription()}`,
    category: raw.category,
    createManually: raw.createManually ?? false,
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
    async (append = false) => {
      // Read the page counter from a ref rather than `state`: the closure
      // would otherwise capture the snapshot from when this callback was
      // created and overwrite updates applied while a request was in flight.
      const nextPage = append ? pageRef.current + 1 : 1

      const result = await backend.getComments({
        first: opts.perPage,
        direction: 'last',
        page: nextPage
      })

      // A page that comes back empty means we have drained the thread; stop
      // advertising "load more" instead of letting the user spin forever.
      const drained = result.comments.length === 0 && append

      setState((prev) => ({
        ...prev,
        comments: drained ? prev.comments : append ? [...prev.comments, ...result.comments] : result.comments,
        hasMore: drained ? false : result.hasNextPage,
        loading: false,
        ready: true,
        error: null,
        rateLimited: false
      }))
      if (!drained) pageRef.current = nextPage
      updateCount(opts.updateCountCallback, result.comments.length)
    },
    [backend, opts.perPage, opts.updateCountCallback]
  )

  const init = useCallback(async () => {
    patch({ loading: true, error: null, rateLimited: false })
    try {
      const thread = await backend.resolveThread({ term: opts.id, number: opts.number })
      threadRef.current = thread

      if (!thread) {
        patch({ missingThread: true, loading: false, ready: true })
        return
      }

      patch({ thread, missingThread: false })
      await load()

      // Restore a draft saved across the OAuth round trip.
      const draft = consumeReturnedDraft()
      if (draft) patch({ draft })

      if (auth.getToken()) {
        const me = await http.get<{ login: string; avatar_url: string }>('/user')
        patch({ user: { login: me.login, avatarUrl: me.avatar_url } })
      }
    } catch (err) {
      reportFailure(patch, err)
    }
  }, [backend, opts.id, opts.number, auth, http, load, patch])

  useEffect(() => {
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
      await load()
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

  const isAdmin = useMemo(() => {
    if (!state.user) return false
    const login = state.user.login.toLowerCase()
    return opts.admin.some((a) => a.toLowerCase() === login)
  }, [state.user, opts.admin])

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
      createThread: async () => {
        patch({ loading: true })
        try {
          const thread = await backend.createThread()
          threadRef.current = thread
          patch({ thread, missingThread: false })
          await load()
        } catch (err) {
          reportFailure(patch, err)
        }
      }
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

function updateCount(cb: ((n: number) => void) | undefined, count: number): void {
  if (typeof cb !== 'function') return
  try {
    cb(count)
  } catch (err) {
    console.warn('updateCountCallback threw:', err)
  }
}

function consumeReturnedDraft(): string {
  try {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('gitalk_token')
    if (token && typeof localStorage !== 'undefined') {
      localStorage.setItem('GT_ACCESS_TOKEN', token)
      params.delete('gitalk_token')
      const next = `${window.location.pathname}?${params}${window.location.hash}`
      history.replaceState(null, '', next)
    }
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
