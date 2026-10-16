export type Reaction = 'HEART' | 'THUMBS_UP' | 'THUMBS_DOWN' | 'LAUGH' | 'HOORAY' | 'CONFUSED' | 'ROCKET' | 'EYES'

/**
 * Backend selection. Gitalk 2.0 defaults to `discussions`.
 *
 * `issues` is retained for backwards compatibility with existing Gitalk
 * installs, but note that issue-backed storage encodes the page id into an
 * issue *label*, which GitHub caps at 50 characters (see gitalk/gitalk#423).
 */
export type BackendKind = 'discussions' | 'issues'

export type SortDirection = 'last' | 'first'

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
  reactions: {
    totalCount: number
    viewerHasReacted: boolean
  }
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
  reactions: {
    totalCount: number
    viewerHasReacted: boolean
  }
  isAuthor: boolean
}

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
  updateCountCallback?: (count: number) => void
}
