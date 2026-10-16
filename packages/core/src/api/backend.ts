import type {
  GitalkComment,
  GitalkReply,
  GitalkUser,
  Reaction,
  ThreadInfo,
  ThreadPage
} from '../types'
import { HttpClient, renderMarkdown } from '../api/client'

export interface Backend {
  readonly kind: 'discussions' | 'issues'
  /** Resolve the thread for this page, optionally creating it. */
  resolveThread(opts: ResolveOptions): Promise<ThreadInfo | null>
  /** Create the thread. Requires an authorized user. */
  createThread(): Promise<ThreadInfo | null>
  /** One page of comments. Replies are normalised into `comment.replies`. */
  getComments(opts: PageOptions): Promise<ThreadPage>
  addComment(body: string, replyTo?: number): Promise<GitalkComment | GitalkReply>
  toggleReaction(target: ReactionTarget, content: Reaction): Promise<void>
  /** Preview rendering; both backends share one implementation. */
  preview(body: string): Promise<string>
}

export interface ResolveOptions {
  term: string
  number?: number
}

export interface PageOptions {
  /** Page size. REST caps this at 100. */
  first: number
  /** Offset page for REST transports. 1-based; ignored by cursor-based ones. */
  page?: number
  after?: string | null
  before?: string | null
  direction?: 'first' | 'last'
}

export interface ReactionTarget {
  commentId: number
  nodeId: string | null
  viewerHasReacted: boolean
}

export interface BackendContext {
  http: HttpClient
  getToken: () => string | null
  owner: string
  repo: string
  getThread: () => ThreadInfo | null
  /** Page identifier used for label/title addressing. */
  term: () => string
  /**
   * Issue a GraphQL request.
   *
   * Routed through the configured proxy when one is set, because GraphQL
   * rejects anonymous callers outright (`x-ratelimit-limit: 0`). The proxy can
   * then attach a GitHub App installation token, which raises the anonymous
   * read limit from 60/hr-per-IP to 5,000/hr. See docs/tech.md §2.1, §3.
   */
  graphql: <T>(body: {
    query: string
    variables: Record<string, unknown>
  }) => Promise<T>
}

export const GHOST_USER: GitalkUser = {
  login: 'ghost',
  avatarUrl: 'https://avatars.githubusercontent.com/u/10137?v=4',
  htmlUrl: 'https://github.com/ghost'
}

/**
 * Shared plumbing backends need: an HTTP client, the current-token accessor,
 * and the owner/repo pair.
 *
 * Note on token usage: an *anonymous* request is the normal steady state for
 * reading. REST discussion/issue reads are CORS-enabled while GraphQL is not
 * reachable anonymously at all, so backends must degrade rather than require
 * login merely to display comments. See docs/tech.md §2.1.
 */
export abstract class BaseBackend implements Backend {
  abstract readonly kind: 'discussions' | 'issues'

  constructor(protected readonly ctx: BackendContext) {}

  abstract resolveThread(opts: ResolveOptions): Promise<ThreadInfo | null>
  abstract createThread(): Promise<ThreadInfo | null>
  abstract getComments(opts: PageOptions): Promise<ThreadPage>
  abstract addComment(body: string, replyTo?: number): Promise<GitalkComment | GitalkReply>
  abstract toggleReaction(target: ReactionTarget, content: Reaction): Promise<void>

  preview(body: string): Promise<string> {
    return renderMarkdown(body, this.ctx.getToken())
  }

  protected threadNumber(): number {
    const thread = this.ctx.getThread()
    if (!thread) throw new Error('Thread has not been resolved yet')
    return thread.number
  }

  protected normalizeUser(user: unknown): GitalkUser {
    if (!user || typeof user !== 'object') return GHOST_USER
    const u = user as { login?: string; avatar_url?: string; html_url?: string }
    return {
      login: u.login ?? GHOST_USER.login,
      avatarUrl: u.avatar_url ?? GHOST_USER.avatarUrl,
      htmlUrl: u.html_url ?? GHOST_USER.htmlUrl
    }
  }

  protected normalizeGraphqlUser(author: unknown): GitalkUser {
    if (!author || typeof author !== 'object') return GHOST_USER
    const a = author as { login?: string; avatarUrl?: string; url?: string }
    return {
      login: a.login ?? GHOST_USER.login,
      avatarUrl: a.avatarUrl ?? GHOST_USER.avatarUrl,
      htmlUrl: a.url ?? GHOST_USER.htmlUrl
    }
  }
}
