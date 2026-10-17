export type Reaction = 'HEART' | 'THUMBS_UP' | 'THUMBS_DOWN' | 'LAUGH' | 'HOORAY' | 'CONFUSED' | 'ROCKET' | 'EYES'

/**
 * The eight reaction types GitHub accepts, in the order its own picker shows
 * them. Kept here (rather than in the component) so backends and the UI agree
 * on one list.
 */
export const REACTIONS: readonly Reaction[] = [
  'THUMBS_UP',
  'THUMBS_DOWN',
  'LAUGH',
  'HOORAY',
  'CONFUSED',
  'HEART',
  'ROCKET',
  'EYES'
]

/** Per-type counts, keyed by {@link Reaction}. */
export type ReactionCounts = Partial<Record<Reaction, number>>

/** Per-type "the viewer used this one" flags, keyed by {@link Reaction}. */
export type ReactionFlags = Partial<Record<Reaction, boolean>>

/**
 * Reactions attached to one comment.
 *
 * GitHub exposes two different shapes and the widget normalises both into
 * this one:
 *
 *  - REST (`full+json`) reports a per-type breakdown but no viewer state, so
 *    `counts` is filled and `viewerReactions` stays empty until the visitor
 *    interacts locally.
 *  - GraphQL reports a single aggregate plus `viewerHasReacted` for one type,
 *    so `viewerReactions` carries that flag and `counts` may be absent.
 */
export interface GitalkReactions {
  /** Aggregate across every type. */
  totalCount: number
  /**
   * Whether the viewer reacted with the comment's *primary* type
   * (`THUMBS_UP`, or `HEART` for the 1.x-era heart rendering). Prefer
   * {@link GitalkReactions.viewerReactions} when you need per-type state.
   */
  viewerHasReacted: boolean
  /** Per-type counts, when the transport reports a breakdown. */
  counts?: ReactionCounts
  /** Per-type viewer state, when the transport reports it (GraphQL only). */
  viewerReactions?: ReactionFlags
}

/**
 * Backend selection. Gitalk 2.0 defaults to `discussions`.
 *
 * `issues` is retained for backwards compatibility with existing Gitalk
 * installs, but note that issue-backed storage encodes the page id into an
 * issue *label*, which GitHub caps at 50 characters (see gitalk/gitalk#423).
 */
export type BackendKind = 'discussions' | 'issues'

export type SortDirection = 'last' | 'first'

/**
 * Corner the collapsed widget parks in.
 *
 * Used by {@link GitalkOptions.fabPosition}; the floating button is only
 * rendered when the visitor has collapsed the widget.
 */
export type FabPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export interface GitalkUser {
  login: string
  avatarUrl: string
  htmlUrl: string
}

export interface GitalkComment {
  /**
   * Stable numeric identifier (REST `id` / GraphQL `databaseId`).
   * Use this for React keys and de-duplication.
   */
  id: number
  /**
   * GitHub GraphQL node id. Required by `addReaction`, `removeReaction`,
   * `addUpvote` and reply mutations. May be null for REST-only results in
   * cases where GitHub omits it; guard before issuing those mutations.
   */
  nodeId: string | null
  user: GitalkUser
  /** Server-rendered HTML. Already sanitized by GitHub. */
  bodyHtml: string
  createdAt: string
  htmlUrl: string
  reactions: GitalkReactions
  isAuthor: boolean
  replies: GitalkReply[]
}

/** One level of nesting: a reply to a top-level comment. */
export interface GitalkReply {
  id: number
  nodeId: string | null
  user: GitalkUser
  bodyHtml: string
  createdAt: string
  htmlUrl: string
  reactions: GitalkReactions
  isAuthor: boolean
}

/**
 * A comment the visitor just submitted, rendered before the server has
 * confirmed it. `key` is a client-only identifier: the server's row replaces
 * the entry carrying the same key, so the optimistic copy never doubles up.
 */
export interface PendingComment {
  /** Client-only stable id (`pending:<n>`). */
  key: string
  body: string
  /** Numeric id of the parent comment, or null for a top-level comment. */
  parentId: number | null
  createdAt: string
  user: GitalkUser
  status: 'sending' | 'failed'
  /** Human-readable reason, set once `status` becomes `failed`. */
  error?: string
}

/** Discussion-level upvote state. */
export interface UpvoteState {
  count: number
  viewerHasUpvoted: boolean
}

/** One page of the thread's comments. */
export interface ThreadPage {
  comments: GitalkComment[]
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  endCursor: string | null
  startCursor: string | null
  /** The page this batch came from, for offset-based transports. */
  page?: number
}

/**
 * The thread "container" the comments hang off: a Discussion today, and still
 * called an Issue when `backend: 'issues'` is selected.
 */
export interface ThreadInfo {
  kind: BackendKind
  /** Discussion/Issue number. */
  number: number
  title: string
  url: string
  /** GraphQL node id, required to write a comment. */
  nodeId: string | null
  locked: boolean
  /**
   * How many comments the thread holds, when the transport reports it.
   *
   * GitHub's comments endpoints ignore `direction`, so the newest-first view
   * has to be assembled from the *last* page of an ascending list; this count
   * is how that page is found without an extra request.
   */
  commentCount?: number
}

export interface GitalkOptions {
  /** OAuth Application client id. */
  clientID: string
  /**
   * OAuth Application client secret.
   *
   * v1 shipped this to the browser. In 2.0 it is only ever sent to YOUR OWN
   * deployed token-exchange proxy (`proxy`), never to api.github.com from the
   * page, and never to a third party. Leave it empty and deploy the worker.
   */
  clientSecret?: string
  repo: string
  owner: string
  admin: string[]
  /** Unique page identifier. */
  id?: string
  /** Explicit Discussion/Issue number. Takes priority over term lookup. */
  number?: number
  /** `discussions` (default) or `issues`. */
  backend?: BackendKind
  /**
   * Discussions-only: category slug or name used when creating a thread.
   *
   * Matched case-insensitively against both the category's `slug` and its
   * `name`. When omitted, the first category `Repository.discussionCategories`
   * returns is used — GitHub's `createDiscussion` requires a category id and
   * offers no default, so a thread cannot be created without one.
   */
  category?: string
  /** Threads created by Gitalk are labelled with these, plus `id`. */
  labels?: string[]
  title?: string
  body?: string
  language?: string
  perPage?: number
  /**
   * Alias for `perPage`, matching the name people already used in v1 configs.
   * `pageSize` wins when both are set.
   */
  pageSize?: number
  /**
   * Which end of the thread to show first.
   *
   * | value            | behaviour                                        |
   * | ---------------- | ------------------------------------------------ |
   * | `'last'` (*default*, and what v1 users expect) | newest comment on top, "load more" walks back in time |
   * | `'first'`        | oldest comment on top, "load more" walks forward  |
   *
   * GitHub's REST comment endpoints **ignore** the `direction` query
   * parameter (verified against api.github.com: `asc`, `desc` and omitting it
   * all return the same ascending payload), so this ordering is applied
   * client-side by the backends rather than trusted from the server.
   */
  sortDirection?: SortDirection
  /**
   * Whether an admin has to create the thread by hand. v1-compatible name.
   *
   * | value                | behaviour                                            |
   * | -------------------- | ---------------------------------------------------- |
   * | `false`              | v1 semantics: an admin visiting a page with no        |
   * |                      | thread creates it automatically.                      |
   * | `true`               | the admin sees the "Initialize" button and clicks it. |
   * | *omitted* (default)  | **manual** — identical to `true`.                     |
   *
   * DELIBERATE DIFFERENCE FROM v1: v1's check was
   * `if (!createIssueManually && this.isAdmin) return this.createIssue()`, so
   * an *omitted* option behaved like `false` and auto-created. 2.0 inverts
   * that: the default is manual. Auto-creating turns every admin page view
   * into a new, empty thread, so it now has to be opted into explicitly —
   * pass `createIssueManually: false` to get the v1 behaviour back.
   *
   * Security boundary (unchanged from v1): only an authenticated viewer whose
   * login appears in `admin` may ever create a thread. Anonymous visitors are
   * shown the "not initialized" notice whatever this option says.
   *
   * Backend note: both backends can create. `issues` uses `POST /issues`;
   * `discussions` uses the GraphQL `createDiscussion` mutation, which requires
   * the visitor to be signed in and the repository to have Discussions enabled
   * with at least one category (see {@link GitalkOptions.category}). Failures
   * are reported with the specific fix (permission, disabled Discussions, or a
   * missing/unknown category).
   */
  createIssueManually?: boolean
  /**
   * @deprecated Earlier 2.x spelling of {@link GitalkOptions.createIssueManually},
   * kept so existing configs still typecheck. Honoured only when
   * `createIssueManually` is absent, and it means the same thing there: an
   * explicit `false` opts into automatic creation, an explicit `true` (or
   * omitting both) leaves the admin a button to click.
   */
  createManually?: boolean
  /**
   * Token-exchange endpoint. Point this at your own deployed edge function
   * from `packages/proxy-worker`.
   */
  proxy?: string
  enableHotKey?: boolean
  distractionFreeMode?: boolean
  /**
   * Offer the `@` participant autocomplete in the comment and reply editors.
   * Defaults to `true`.
   *
   * Candidates are the de-duplicated authors/repliers already loaded in the
   * thread, so the list never advertises someone the visitor cannot see.
   */
  mentions?: boolean
  /**
   * Render the per-comment reaction control (the eight GitHub reaction types,
   * with per-type counts). Defaults to `true`. Set to `false` to leave the
   * action row to the reply button alone.
   */
  reactions?: boolean
  /**
   * Render the discussion-level upvote control. Defaults to `true`.
   *
   * Upvotes are a Discussions-only concept — GitHub exposes no equivalent for
   * Issues — so the control is never rendered on the `issues` backend, and no
   * request is made for it either.
   *
   * It also requires a signed-in viewer, and with a GitHub App user token
   * (`ghu_`, what this widget's login flow mints) the control is rendered
   * disabled with an explanation: GitHub rejects the upvote mutations for
   * app-issued tokens regardless of the App's `Discussions: write` permission.
   * Set this to `false` to omit it entirely.
   */
  upvote?: boolean
  /**
   * Collapse the whole widget into a floating action button (the design
   * reference's `.fab`), and expand it again on click.
   *
   * | value              | behaviour                                              |
   * | ------------------ | ------------------------------------------------------ |
   * | `true` (*default*) | the section header carries a minimise control;        |
   * |                    | clicking it hides the widget and parks a FAB in        |
   * |                    | `fabPosition`. Clicking the FAB restores the widget.   |
   * | `false`            | no minimise control and no FAB — the widget stays      |
   * |                    | expanded, exactly as in 2.x before this option.        |
   *
   * The widget starts expanded: the FAB is not shown until the visitor
   * collapses it. Nothing is persisted, so every page load starts expanded.
   */
  minimizable?: boolean
  /**
   * Corner the collapsed floating button parks in. Defaults to
   * `'bottom-right'` (the design reference's position).
   *
   * One of `'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'`.
   * Safe-area insets are respected on every corner. Ignored when
   * {@link GitalkOptions.minimizable} is `false`.
   */
  fabPosition?: FabPosition
  /**
   * Maximum height of the scrolling comment list.
   *
   * - `number` — pixels, e.g. `520` becomes `520px`;
   * - `string` — any CSS length or expression, e.g. `'60vh'` or
   *   `'min(700px, calc(100dvh - 200px))'`;
   * - `null` — **no limit**: the list grows with the thread and the page
   *   scrolls instead of the list.
   *
   * Defaults to `'min(700px, calc(100dvh - 200px))'`, the design reference's
   * demo height. The count header, composer and footer sit outside this
   * scroll area and stay visible.
   */
  maxHeight?: number | string | null
  /**
   * Keep the composer within reach while reading.
   *
   * When the widget's bottom edge reaches the bottom of the viewport, the
   * composer detaches from the page flow and sticks to the bottom of the
   * viewport (the design reference's `.p-composer.is-fixed`), until the widget
   * scrolls out of view or the visitor collapses it. Defaults to `true`.
   *
   * Set to `false` to leave the composer in the normal document flow, as in
   * earlier 2.x releases. Inline reply boxes inside individual comments are
   * unaffected: they always stay attached to their comment.
   */
  stickyComposer?: boolean
  updateCountCallback?: (count: number) => void
}
