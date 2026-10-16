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
  /** Discussions-only: category slug or name used when creating a thread. */
  category?: string
  /** Threads created by Gitalk are labelled with these, plus `id`. */
  labels?: string[]
  title?: string
  body?: string
  language?: string
  perPage?: number
  sortDirection?: SortDirection
  /** Require an admin to click "init" instead of auto-creating the thread. */
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
