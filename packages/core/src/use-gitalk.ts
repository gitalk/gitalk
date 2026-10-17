import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { Backend } from './api/backend'
import type { ReactionState } from './api/backend'
import type { BackendContext } from './api/backend'
import { DiscussionsBackend } from './api/discussions'
import { IssuesBackend } from './api/issues'
import { Auth } from './auth'
import {
  API_VERSION,
  GITHUB_API,
  GitalkError,
  HttpClient,
  NEXT_GLOBAL_ID_HEADER,
  RateLimitError,
  extractMessage
} from './api/client'
import { createTranslator } from './i18n'
import { normalizeUploadResult, withTimeout } from './images'
import { GitalkImageUploadError } from './types'
import type {
  BackendKind,
  GitalkComment,
  GitalkComment as Comment,
  GitalkOptions,
  GitalkReply,
  GitalkUploadedImage,
  PendingComment,
  Reaction,
  ThreadInfo,
  UpvoteState
} from './types'

/** Why the visitor is being told to sign in. */
export type LoginReason = 'comment' | 'reply' | 'react' | 'upvote'

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
  /** True while a Markdown render is in flight, so the toggle can say so. */
  previewBusy: boolean
  previewHtml: string
  /** Draft the current `previewHtml` was rendered from (live-preview guard). */
  previewDraft: string
  submitting: boolean
  loadingMore: boolean
  hasMore: boolean
  /** The comment whose inline reply box is open. At most one at a time. */
  replyTarget: { id: number; login: string } | null
  replyDraft: string
  replySubmitting: boolean
  /** Comments submitted but not yet confirmed by GitHub. */
  pending: PendingComment[]
  /** Discussion-level upvote, when the backend has one. */
  upvote: UpvoteState | null
  /**
   * A short, dismissible message shown above the composer — currently used to
   * answer an anonymous click on a write control with "sign in", instead of
   * letting the click do nothing.
   */
  notice: string | null
  /** True while a host `onUploadImage` call is in flight. */
  imageUploading: boolean
  /** Handler-reported progress; null until it calls `onProgress`. */
  imageUploadProgress: { loaded: number; total: number } | null
  /** Last upload failure. Holds the original files for "retry". */
  imageUploadError: GitalkImageUploadError | null
}

const DEFAULTS = {
  perPage: 10,
  labels: ['Gitalk'],
  backend: 'discussions' as BackendKind,
  enableHotKey: true,
  distractionFreeMode: false,
  mentions: true,
  reactions: true,
  upvote: true,
  minimizable: true,
  fabPosition: 'bottom-right' as const,
  /**
   * The design reference's demo height: a fixed 700px ceiling on tall
   * viewports, and 200px of breathing room on short ones.
   */
  maxHeight: 'min(700px, calc(100dvh - 200px))' as string | null,
  stickyComposer: true,
  imageUploadTimeout: 30000,
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
    mentions: raw.mentions ?? DEFAULTS.mentions,
    onUploadImage: raw.onUploadImage,
    imageUploadTimeout: raw.imageUploadTimeout ?? DEFAULTS.imageUploadTimeout,
    reactions: raw.reactions ?? DEFAULTS.reactions,
    upvote: raw.upvote ?? DEFAULTS.upvote,
    minimizable: raw.minimizable ?? DEFAULTS.minimizable,
    fabPosition: raw.fabPosition ?? DEFAULTS.fabPosition,
    // `undefined` means "use the demo height"; an explicit `null` means "no
    // limit" and must survive normalisation. Numbers are pixels.
    maxHeight:
      raw.maxHeight === undefined
        ? DEFAULTS.maxHeight
        : raw.maxHeight === null
          ? null
          : typeof raw.maxHeight === 'number'
            ? `${raw.maxHeight}px`
            : raw.maxHeight,
    stickyComposer: raw.stickyComposer ?? DEFAULTS.stickyComposer,
    // v1's `sortDirection` was documented but never wired up. `'last'` (newest
    // first) is both the v1 default and what people expect from a comment box.
    sortDirection: raw.sortDirection === 'first' ? ('first' as const) : ('last' as const),
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
    previewBusy: false,
    previewHtml: '',
    previewDraft: '',
    submitting: false,
    loadingMore: false,
    hasMore: false,
    replyTarget: null,
    replyDraft: '',
    replySubmitting: false,
    pending: [],
    upvote: null,
    notice: null,
    imageUploading: false,
    imageUploadProgress: null,
    imageUploadError: null
  })

  const patch = useCallback((next: Partial<GitalkState>) => {
    setState((prev) => ({ ...prev, ...next }))
  }, [])

  /**
   * The host callback lives in a ref so the upload action never captures a
   * stale closure after `mount.update()` swaps the handler.
   */
  const uploadHandlerRef = useRef(opts.onUploadImage)
  uploadHandlerRef.current = opts.onUploadImage
  /** Cancels the upload in flight (visitor cancel or widget unmount). */
  const uploadAbortRef = useRef<AbortController | null>(null)
  /**
   * Monotonic upload token. A late handler result may resolve after a cancel
   * or a newer upload; comparing the token is what keeps that result from
   * being inserted.
   */
  const uploadSeq = useRef(0)

  const http = useMemo(
    () => new HttpClient(() => auth.getToken()),
    [auth]
  )

  /**
   * One-shot circuit breaker for the anonymous read accelerator.
   *
   * If the configured proxy cannot serve a read (uninstalled App, private
   * repository, unreachable host, missing installation token), every later
   * read in this widget goes straight to api.github.com instead of paying the
   * same failed round trip again. The fallback is the existing REST path, so
   * the worst case is exactly the behaviour before this accelerator existed.
   */
  const proxyReadUnavailable = useRef(false)
  const proxyRead = useCallback(
    async <T,>(
      body: { query: string; variables: Record<string, unknown> },
      options?: { fresh?: boolean }
    ): Promise<T | null> => {
      // The accelerator is opt-in: without an explicit `proxy` option the
      // widget keeps the browser's original REST read path. That avoids
      // sending a site's read traffic to the hosted default endpoint just
      // because it was used for sign-in.
      if (!opts.proxy) return null
      // Only anonymous reads are accelerated. A signed-in visitor already has
      // a 5,000/hr GraphQL quota, and their existing REST read path carries
      // viewer-specific behaviour that must not change underneath them.
      if (auth.getToken()) return null
      if (proxyReadUnavailable.current) return null
      const result = await sendProxyRead<T>(body, auth, options)
      if (result === null) proxyReadUnavailable.current = true
      return result
    },
    [auth, opts.proxy]
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
      graphql: (body) => sendGraphql(body, auth),
      proxyRead
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
  }, [
    http,
    auth,
    proxyRead,
    opts.owner,
    opts.repo,
    opts.backend,
    opts.id,
    opts.labels,
    opts.title,
    opts.body,
    opts.category
  ])

  const t = useMemo(() => createTranslator(options.language ?? navigator.language), [options.language])

  /**
   * Fill in per-type reaction state for the comments just loaded.
   *
   * REST reports counts but never "did *you* react", so without this the
   * picker would forget the viewer's own reactions on every reload. It is a
   * single GraphQL request per page and purely cosmetic: a failure is logged
   * and the counts from REST stand.
   */
  const hydrateReactions = useCallback(
    async (comments: GitalkComment[]) => {
      if (!auth.getToken()) return
      const ids = comments.flatMap((c) => [
        c.nodeId,
        ...(c.replies ?? []).map((r) => r.nodeId)
      ])
      const nodeIds = ids.filter((id): id is string => Boolean(id))
      if (!nodeIds.length) return

      let states: Map<string, ReactionState>
      try {
        states = await backend.getReactionStates(nodeIds)
      } catch (err) {
        console.warn('gitalk: could not read per-type reaction state', err)
        return
      }
      if (!states.size) return

      setState((prev) => ({
        ...prev,
        comments: prev.comments.map((c) => {
          const withReplies = (c.replies ?? []).map((r) => mergeReactionState(r, states))
          return mergeReactionState({ ...c, replies: withReplies }, states)
        })
      }))
    },
    [auth, backend]
  )

  const load = useCallback(
    async (append = false, fresh = false) => {
      // Read the page counter from a ref rather than `state`: the closure
      // would otherwise capture the snapshot from when this callback was
      // created and overwrite updates applied while a request was in flight.
      const nextPage = append ? pageRef.current + 1 : 1

      const result = await backend.getComments({
        first: opts.perPage,
        // GitHub ignores `direction` on the comments endpoints, so the
        // backends order the rows and pick the window themselves. It is still
        // passed so a transport that *does* honour it behaves the same way.
        direction: opts.sortDirection,
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

      // Deliberately not awaited: the comment list is already on screen, and
      // this only sharpens the reaction chips.
      void hydrateReactions(nextComments)
    },
    [backend, hydrateReactions, opts.perPage, opts.sortDirection, opts.updateCountCallback]
  )

  /**
   * Fetch the discussion-level upvote state.
   *
   * Only ever called for a signed-in viewer on a backend that has upvotes:
   * the fields live behind GraphQL, whose anonymous quota is zero, so asking
   * while signed out would be a guaranteed 403 dressed up as an error box.
   * A failure here is cosmetic — the control still renders — so it is logged
   * rather than reported as a page-level error.
   */
  const loadUpvote = useCallback(async () => {
    if (!opts.upvote || !backend.supportsUpvote) return
    try {
      const upvote = await backend.getUpvote()
      if (upvote) patch({ upvote })
    } catch (err) {
      console.warn('gitalk: could not read the upvote count', err)
    }
  }, [backend, opts.upvote, patch])

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

      // Signed-in visitors can also see how the discussion itself is doing.
      await loadUpvote()
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
    loadUpvote,
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

  /**
   * Unmounting aborts an in-flight upload: the handler's signal fires, and the
   * token bump makes any result that still arrives a no-op.
   */
  useEffect(
    () => () => {
      uploadSeq.current++
      uploadAbortRef.current?.abort()
      uploadAbortRef.current = null
    },
    []
  )

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

  /** Anonymous clicks on a write control answer with a way to sign in. */
  const requireLogin = useCallback(
    (reason: LoginReason) => {
      const message =
        reason === 'reply'
          ? t('login-to-reply')
          : reason === 'react'
            ? t('login-to-react')
            : reason === 'upvote'
              ? t('login-to-upvote')
              : t('login-to-comment')
      patch({ notice: message })
    },
    [patch, t]
  )

  const dismissNotice = useCallback(() => patch({ notice: null }), [patch])

  const pendingSeq = useRef(0)

  /**
   * Place a comment the server just returned.
   *
   * `load(false, true)` normally already contains it, but the fresh read is a
   * network round trip with its own pagination, and a row that arrived a
   * moment too late must not cost the author their comment.
   */
  const placeCreated = useCallback(
    (created: GitalkComment | GitalkReply, parentId: number | null) => {
      setState((prev) => {
        const already = prev.comments.some(
          (c) => c.id === created.id || c.replies?.some((r) => r.id === created.id)
        )
        if (already) return prev
        if (parentId == null) {
          return { ...prev, comments: [{ ...(created as GitalkComment) }, ...prev.comments] }
        }
        return {
          ...prev,
          comments: prev.comments.map((c) =>
            c.id === parentId
              ? { ...c, replies: [...c.replies, created as GitalkReply] }
              : c
          )
        }
      })
    },
    []
  )

  const dropPending = useCallback((key: string) => {
    setState((prev) => ({ ...prev, pending: prev.pending.filter((p) => p.key !== key) }))
  }, [])

  /**
   * Post a comment optimistically.
   *
   * The row appears immediately under a client-only key, then the server's row
   * *replaces* it: the same key can never appear twice, because the pending
   * entry is only dropped once the authoritative list has been read (or the
   * comment placed by hand if that read missed it).
   *
   * A failure keeps the entry, marked `failed`, so the author can see exactly
   * which comment did not go through; it is not a comment, it is a retryable
   * draft, and `retryPending`/`dismissPending` are the two ways out.
   */
  const postComment = useCallback(
    async (body: string, parentId: number | null) => {
      const key = `pending:${++pendingSeq.current}`
      const entry: PendingComment = {
        key,
        body,
        parentId,
        createdAt: new Date().toISOString(),
        user: {
          login: state.user?.login ?? t('anonymous'),
          avatarUrl: state.user?.avatarUrl ?? '',
          htmlUrl: '#'
        },
        status: 'sending'
      }

      setState((prev) => ({ ...prev, pending: [...prev.pending, entry] }))

      try {
        const created = await backend.addComment(body, parentId ?? undefined)
        // The count the thread was resolved with predates this comment. Bump it
        // so the *next* "load more" still maps its page onto the right offset
        // (the immediate read below re-probes the end and does not rely on it).
        const thread = threadRef.current
        if (thread && typeof thread.commentCount === 'number') {
          threadRef.current = { ...thread, commentCount: thread.commentCount + 1 }
        }
        // A plain reload can be answered from the browser's copy of the
        // comments response, which still predates this comment.
        await load(false, true)
        placeCreated(created, parentId)
        dropPending(key)
        return true
      } catch (err) {
        const message =
          err instanceof GitalkError ? err.message : err instanceof Error ? err.message : String(err)
        setState((prev) => ({
          ...prev,
          pending: prev.pending.map((p) =>
            p.key === key ? { ...p, status: 'failed' as const, error: message } : p
          )
        }))
        return false
      }
    },
    [backend, dropPending, load, placeCreated, state.user, t]
  )

  const submit = useCallback(async () => {
    const body = state.draft.trim()
    if (!body) return
    if (!auth.getToken()) {
      requireLogin('comment')
      return
    }
    // The composer clears straight away: the optimistic row is the feedback,
    // and leaving the text behind would invite a double post.
    patch({ draft: '', submitting: true, previewing: false, previewHtml: '', previewDraft: '' })
    await postComment(body, null)
    patch({ submitting: false })
  }, [auth, patch, postComment, requireLogin, state.draft])

  /**
   * Hand the selected files to the site's `onUploadImage` and validate what it
   * returns. Resolves to the images to insert, or null on any failure.
   *
   * All-or-nothing: if one file fails validation the whole call fails, so the
   * widget never inserts a partial selection. The Markdown itself is built by
   * the caller from the returned URLs — the handler never gets to inject text.
   */
  const uploadImage = useCallback(
    async (files: File[]): Promise<GitalkUploadedImage[] | null> => {
      const handler = uploadHandlerRef.current
      if (!handler || files.length === 0) return null

      // A second call supersedes the first; the old controller is aborted and
      // its late result ignored via the token.
      uploadAbortRef.current?.abort()
      const controller = new AbortController()
      uploadAbortRef.current = controller
      const seq = ++uploadSeq.current

      patch({ imageUploading: true, imageUploadProgress: null, imageUploadError: null })

      try {
        // Validated before the handler runs, so a non-image selection never
        // reaches site code at all.
        if (files.some((file) => !file.type?.startsWith('image/'))) {
          throw new GitalkImageUploadError(
            'rejected',
            files,
            new Error('only image files can be uploaded')
          )
        }

        const work = Promise.resolve().then(() =>
          handler(files, {
            signal: controller.signal,
            onProgress: (loaded, total) => {
              if (seq !== uploadSeq.current || controller.signal.aborted) return
              patch({ imageUploadProgress: { loaded, total } })
            }
          })
        )

        const result = await withTimeout(work, opts.imageUploadTimeout, {
          signal: controller.signal,
          files,
          // A handler that ignores its signal cannot wedge the button: the
          // timeout wins and the controller is aborted anyway.
          onTimeout: () => controller.abort()
        })

        if (seq !== uploadSeq.current || controller.signal.aborted) return null
        const images = normalizeUploadResult(result, files)
        patch({ imageUploading: false, imageUploadProgress: null, imageUploadError: null })
        return images
      } catch (err) {
        // Superseded or cancelled: the visitor asked not to see a failure.
        if (seq !== uploadSeq.current) return null
        if (err instanceof GitalkImageUploadError && err.code === 'aborted') {
          patch({ imageUploading: false, imageUploadProgress: null })
          return null
        }

        const base =
          err instanceof GitalkImageUploadError
            ? err
            : new GitalkImageUploadError('rejected', files, err)
        const error = base.files.length
          ? base
          : new GitalkImageUploadError(base.code, files, base.cause ?? new Error(base.message))
        patch({ imageUploading: false, imageUploadProgress: null, imageUploadError: error })
        return null
      } finally {
        if (uploadAbortRef.current === controller) uploadAbortRef.current = null
      }
    },
    [opts.imageUploadTimeout, patch]
  )

  /**
   * Cancel an in-flight upload. This is the only failure path that never
   * raises an error row; the token bump discards a handler that resolves later.
   */
  const cancelImageUpload = useCallback(() => {
    const controller = uploadAbortRef.current
    if (!controller) return
    uploadSeq.current++
    uploadAbortRef.current = null
    controller.abort()
    patch({ imageUploading: false, imageUploadProgress: null, imageUploadError: null })
  }, [patch])

  /**
   * Monotonic token for preview requests. Typing while the floating preview is
   * open fires one request per pause; without this, a slow earlier response
   * could land after a newer one and show the wrong Markdown.
   */
  const previewSeq = useRef(0)

  /**
   * Render `body` through GitHub's Markdown endpoint and adopt the result.
   * Returns the HTML, or null when the request failed or was superseded.
   */
  const renderPreview = useCallback(
    async (body: string): Promise<string | null> => {
      const seq = ++previewSeq.current
      try {
        const html = await backend.preview(body)
        if (seq !== previewSeq.current) return null
        patch({ previewHtml: html, previewDraft: body })
        return html
      } catch (err) {
        if (seq === previewSeq.current) reportFailure(patch, err)
        return null
      }
    },
    [backend, patch]
  )

  /**
   * Close the preview without toggling it open again. Collapsing the widget
   * uses this so restoring it does not bring back a stale preview panel.
   */
  const closePreview = useCallback(() => {
    previewSeq.current++
    patch({ previewing: false })
  }, [patch])

  /**
   * Render the draft and show it inside the composer.
   *
   * The preview is manual: the composer's source/preview button is the only
   * caller. Nothing watches the draft, so typing never spends a request on
   * GitHub's Markdown endpoint. A failed or superseded render leaves the
   * composer in source mode.
   */
  const refreshPreview = useCallback(async () => {
    if (!state.draft.trim()) {
      closePreview()
      return
    }
    patch({ previewBusy: true })
    try {
      const html = await renderPreview(state.draft)
      if (html !== null) patch({ previewing: true })
    } finally {
      // Always clear: a failed render must not leave the toggle spinning.
      patch({ previewBusy: false })
    }
  }, [closePreview, patch, renderPreview, state.draft])

  /**
   * Open the inline reply box for one comment.
   *
   * There is deliberately only ever one: `replyTarget` is a single slot, so
   * opening a second reply closes the first instead of stacking editors down
   * the page. Replies go to the comment they were opened on, never to the top
   * composer.
   */
  const replyTo = useCallback((comment: GitalkComment) => {
    setState((prev) => {
      // Clicking the button of the already-open box closes it (a toggle), which
      // is what the design reference does.
      if (prev.replyTarget?.id === comment.id) {
        return { ...prev, replyTarget: null, replyDraft: '' }
      }
      return {
        ...prev,
        replyTarget: { id: comment.id, login: comment.user.login },
        replyDraft: ''
      }
    })
  }, [])

  const cancelReply = useCallback(() => {
    setState((prev) => ({ ...prev, replyTarget: null, replyDraft: '' }))
  }, [])

  const setReplyDraft = useCallback((replyDraft: string) => patch({ replyDraft }), [patch])

  const submitReply = useCallback(async () => {
    const target = state.replyTarget
    const body = state.replyDraft.trim()
    if (!target || !body) return
    if (!auth.getToken()) {
      requireLogin('reply')
      return
    }
    patch({ replyTarget: null, replyDraft: '', replySubmitting: true })
    await postComment(body, target.id)
    patch({ replySubmitting: false })
  }, [auth, patch, postComment, requireLogin, state.replyDraft, state.replyTarget])

  const retryPending = useCallback(
    async (key: string) => {
      const entry = state.pending.find((p) => p.key === key)
      if (!entry || entry.status === 'sending') return
      setState((prev) => ({
        ...prev,
        pending: prev.pending.map((p) =>
          p.key === key ? { ...p, status: 'sending' as const, error: undefined } : p
        )
      }))
      try {
        const created = await backend.addComment(entry.body, entry.parentId ?? undefined)
        await load(false, true)
        placeCreated(created, entry.parentId)
        dropPending(key)
      } catch (err) {
        const message =
          err instanceof GitalkError ? err.message : err instanceof Error ? err.message : String(err)
        setState((prev) => ({
          ...prev,
          pending: prev.pending.map((p) =>
            p.key === key ? { ...p, status: 'failed' as const, error: message } : p
          )
        }))
      }
    },
    [backend, dropPending, load, placeCreated, state.pending]
  )

  const dismissPending = useCallback((key: string) => dropPending(key), [dropPending])

  /**
   * Toggle one reaction type on one comment.
   *
   * `viewerReactions` is per-type — a viewer may hold all eight at once — so
   * the flag passed to the backend describes *this* content, not the comment.
   * The count and the flag move together, optimistically, and both are put
   * back if GitHub refuses.
   */
  const applyReaction = useCallback(
    (commentId: number, content: Reaction, delta: number, viewerHasReacted: boolean) => {
      setState((prev) => ({
        ...prev,
        comments: prev.comments.map((c) => {
          if (c.id === commentId) return updateReaction(c, content, delta, viewerHasReacted)
          if (c.replies?.some((r) => r.id === commentId)) {
            return {
              ...c,
              replies: c.replies.map((r) =>
                r.id === commentId ? updateReaction(r, content, delta, viewerHasReacted) : r
              )
            }
          }
          return c
        })
      }))
    },
    []
  )

  const toggleReaction = useCallback(
    async (comment: GitalkComment | GitalkReply, content: Reaction) => {
      if (!auth.getToken()) {
        requireLogin('react')
        return
      }
      const reacted = Boolean(comment.reactions.viewerReactions?.[content])
      applyReaction(comment.id, content, reacted ? -1 : 1, !reacted)
      try {
        await backend.toggleReaction(
          { commentId: comment.id, nodeId: comment.nodeId, viewerHasReacted: reacted },
          content
        )
      } catch (err) {
        // Roll the optimistic count back before showing why.
        applyReaction(comment.id, content, reacted ? 1 : -1, reacted)
        reportFailure(patch, err)
      }
    },
    [applyReaction, auth, backend, patch, requireLogin]
  )

  /**
   * Toggle the discussion upvote.
   *
   * Optimistic like reactions, and gated the same way. The extra `ghu_` check
   * is a hard stop for GitHub App user tokens: GitHub answers those mutations
   * with FORBIDDEN even with `Discussions: write`, so the UI never offers the
   * click (see `Auth.isAppUserToken`).
   */
  const setUpvote = useCallback(
    async (next: boolean) => {
      if (!backend.supportsUpvote) return
      if (!auth.getToken()) {
        requireLogin('upvote')
        return
      }
      // App-issued user tokens cannot upvote at all; don't even try and turn a
      // GitHub limitation into an error banner.
      if (auth.isAppUserToken()) return
      const previous = state.upvote ?? { count: 0, viewerHasUpvoted: false }
      patch({
        upvote: {
          count: Math.max(0, previous.count + (next ? 1 : -1)),
          viewerHasUpvoted: next
        }
      })
      try {
        await backend.setUpvote(next)
      } catch (err) {
        patch({ upvote: previous })
        reportFailure(patch, err)
      }
    },
    [auth, backend, patch, requireLogin, state.upvote]
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
      refreshPreview,
      closePreview,
      replyTo,
      cancelReply,
      setReplyDraft,
      submitReply,
      toggleReaction,
      setUpvote,
      retryPending,
      dismissPending,
      dismissNotice,
      requireLogin,
      loadMore,
      createThread,
      uploadImage,
      cancelImageUpload
    },
    meta: {
      owner: opts.owner,
      repo: opts.repo,
      isAdmin,
      supportsPreview: true,
      authenticated: Boolean(auth.getToken()),
      /** False when no clientID is configured: the UI hides login affordances. */
      canLogin: auth.canLogin(),
      /**
       * OAuth entry point, or null when sign-in is unavailable.
       *
       * The composer prompt and the notice render this as a real `href`, so
       * both the sentence and the button are links; the click is intercepted
       * only to run the same draft-saving path as `actions.login`.
       */
      loginUrl: auth.canLogin()
        ? auth.loginUrl(typeof window === 'undefined' ? '' : window.location.href)
        : null,
      /** Discussions have threaded replies; issues do not. */
      canReply: backend.kind === 'discussions',
      /** Upvotes exist on Discussions only — never render the control otherwise. */
      canUpvote: backend.supportsUpvote && opts.upvote && Boolean(auth.getToken()),
      /**
       * Whether that control may actually be pressed.
       *
       * GitHub App user tokens (`ghu_`) cannot call `addUpvote`/`removeUpvote`
       * — GitHub returns FORBIDDEN regardless of the App's permissions — so
       * the widget shows the count but disables the button and explains why.
       * Anonymous visitors get no control at all: the only sign-in path this
       * widget owns mints an App token, so there is nothing to log in *to*.
       */
      canToggleUpvote:
        backend.supportsUpvote &&
        opts.upvote &&
        Boolean(auth.getToken()) &&
        !auth.isAppUserToken(),
      showMentions: opts.mentions,
      showReactions: opts.reactions,
      /**
       * Image upload is opt-in AND signed-in only. Without a handler there is
       * nothing to call, so the control is not rendered at all; anonymous
       * visitors follow `gt-btn-public`'s rule because inserting Markdown
       * without being able to post it would only lose the draft.
       */
      canUploadImage: Boolean(opts.onUploadImage) && Boolean(auth.getToken()),
      sortDirection: opts.sortDirection,
      /** Collapse-to-FAB is on by default; the widget owns the open state. */
      showMinimizable: opts.minimizable,
      fabPosition: opts.fabPosition,
      /** Normalised to a CSS value, or null for "no limit". */
      maxHeight: opts.maxHeight,
      /** Whether the composer may dock to the viewport bottom. */
      stickyComposer: opts.stickyComposer,
      proxy: auth.proxy
    }
  }
}

/**
 * Fold server-reported reaction state into one comment.
 *
 * The server is authoritative for both the per-type counts and the viewer
 * flags here, because this is the only transport that knows about the viewer.
 */
function mergeReactionState<T extends GitalkComment | GitalkReply>(
  item: T,
  states: Map<string, ReactionState>
): T {
  const state = item.nodeId ? states.get(item.nodeId) : undefined
  if (!state) return item

  const counts = state.counts
  return {
    ...item,
    reactions: {
      ...item.reactions,
      counts,
      viewerReactions: state.viewerReactions,
      totalCount: Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0),
      viewerHasReacted: Object.keys(state.viewerReactions).length > 0
    }
  }
}

/**
 * Move one reaction's count and viewer flag on one comment, in place.
 *
 * Replies are matched too: they live in the same tree and the same server
 * mutation applies to them.
 */
function updateReaction<T extends GitalkComment | GitalkReply>(
  item: T,
  content: Reaction,
  delta: number,
  viewerHasReacted: boolean
): T {
  const counts = { ...(item.reactions.counts ?? {}) }
  const viewer = { ...(item.reactions.viewerReactions ?? {}) }
  const nextCount = Math.max(0, (counts[content] ?? 0) + delta)
  if (nextCount > 0) counts[content] = nextCount
  else delete counts[content]
  if (viewerHasReacted) viewer[content] = true
  else delete viewer[content]

  return {
    ...item,
    reactions: {
      ...item.reactions,
      totalCount: Math.max(0, item.reactions.totalCount + delta),
      viewerHasReacted,
      counts,
      viewerReactions: viewer
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
    'X-GitHub-Api-Version': API_VERSION,
    // Ask for the same id format the REST reads now return, so ids that come
    // back *from* GraphQL (a freshly created comment/discussion) are usable in
    // later mutations without a deprecation warning.
    [NEXT_GLOBAL_ID_HEADER]: '1'
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

/**
 * Conditional-read cache for anonymous proxy reads.
 *
 * A browser does not HTTP-cache a POST response, so the proxy's `ETag` /
 * `Cache-Control` headers alone would not save anything in the page. Keeping
 * the last response body here lets a repeated identical read revalidate with
 * `If-None-Match`: a 304 then costs one proxy hop and zero GitHub quota, and
 * the browser's own cache (when the endpoint supplies cache headers) still
 * works for the request itself. Signed-in reads are deliberately not cached:
 * their body may contain viewer-specific reaction flags.
 */
const PROXY_READ_CACHE_LIMIT = 32
const proxyReadCache = new Map<string, { etag: string; data: unknown }>()

/** Run a read through the anonymous-capable proxy endpoint. Never throws. */
async function sendProxyRead<T>(
  body: { query: string; variables: Record<string, unknown> },
  auth: Auth,
  options: { fresh?: boolean } = {}
): Promise<T | null> {
  const endpoint = auth.proxy.replace(/\/$/, '')
  if (!endpoint) return null

  const token = auth.getToken()
  const cacheKey = `${endpoint}\n${JSON.stringify(body)}`
  const cached = token || options.fresh ? undefined : proxyReadCache.get(cacheKey)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    [NEXT_GLOBAL_ID_HEADER]: '1'
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (cached?.etag) headers['If-None-Match'] = cached.etag

  let response: Response
  try {
    response = await fetch(`${endpoint}/graphql`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
  } catch {
    return null
  }

  if (response.status === 304) {
    return cached ? (cached.data as T) : null
  }
  if (!response.ok) return null

  let payload: { data?: T; errors?: unknown[] }
  try {
    payload = (await response.json()) as { data?: T; errors?: unknown[] }
  } catch {
    return null
  }
  if (payload.errors?.length || payload.data == null) return null

  if (!token) {
    const etag = response.headers.get('ETag')
    if (etag) {
      // Bound the cache: a long thread can walk through many cursor pages.
      if (proxyReadCache.size >= PROXY_READ_CACHE_LIMIT) {
        const oldest = proxyReadCache.keys().next().value
        if (oldest !== undefined) proxyReadCache.delete(oldest)
      }
      proxyReadCache.set(cacheKey, { etag, data: payload.data })
    } else {
      proxyReadCache.delete(cacheKey)
    }
  }

  return payload.data
}
