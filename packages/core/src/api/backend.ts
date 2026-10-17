import type {
  GitalkComment,
  GitalkReactions,
  GitalkReply,
  GitalkUser,
  Reaction,
  ReactionCounts,
  ReactionFlags,
  ThreadInfo,
  ThreadPage,
  UpvoteState
} from '../types'
import { REACTIONS } from '../types'
import { GitalkError, HttpClient, renderMarkdown } from '../api/client'

export interface Backend {
  readonly kind: 'discussions' | 'issues'
  /**
   * Whether this backend can upvote the thread itself.
   *
   * Upvotes are a Discussions concept: GitHub's GraphQL API exposes
   * `addUpvote`/`removeUpvote` on Discussable subjects only, and there is no
   * Issue equivalent. Callers must check this before rendering the control,
   * so an Issues-backed widget degrades to "no control" instead of throwing.
   */
  readonly supportsUpvote: boolean
  /** Resolve the thread for this page, optionally creating it. */
  resolveThread(opts: ResolveOptions): Promise<ThreadInfo | null>
  /** Create the thread. Requires an authorized user. */
  createThread(): Promise<ThreadInfo | null>
  /** One page of comments. Replies are normalised into `comment.replies`. */
  getComments(opts: PageOptions): Promise<ThreadPage>
  addComment(body: string, replyTo?: number): Promise<GitalkComment | GitalkReply>
  toggleReaction(target: ReactionTarget, content: Reaction): Promise<void>
  /**
   * Per-type reaction state for a batch of comment node ids.
   *
   * REST reports per-type *counts* but cannot say whether the viewer is one of
   * them, so a page reload would otherwise lose the "you reacted with this"
   * highlight. GraphQL can answer it for a whole page in one request, which is
   * what this is for. Backends that cannot answer return an empty map.
   */
  getReactionStates(nodeIds: string[]): Promise<Map<string, ReactionState>>
  /** Thread-level upvote state, or null when the backend has no upvotes. */
  getUpvote(): Promise<UpvoteState | null>
  /** Add or remove the viewer's upvote. Throws on backends without upvotes. */
  setUpvote(on: boolean): Promise<void>
  /** Preview rendering; both backends share one implementation. */
  preview(body: string): Promise<string>
}

/** One comment's reaction state, as reported by a state-aware transport. */
export interface ReactionState {
  counts: ReactionCounts
  viewerReactions: ReactionFlags
}

export interface ResolveOptions {
  term: string
  number?: number
}

export interface PageOptions {
  /** Page size. REST caps this at 100. */
  first: number
  /**
   * Bypass the HTTP cache for this read. Set after a write: GitHub serves the
   * comments endpoint with `cache-control: public, max-age=60`, so an
   * immediate reload can be answered from the browser's copy and show the
   * list as it was before the comment was posted.
   */
  fresh?: boolean
  /**
   * Offset page for REST transports. 1-based; ignored by cursor-based ones.
   *
   * When `direction` is `'last'` this counts *logical* pages from the newest
   * end: page 1 is the newest block, page 2 the block before it, and so on.
   * The transports map it onto a real offset page internally — see
   * {@link BaseBackend.readCommentPage}.
   */
  page?: number
  after?: string | null
  before?: string | null
  /**
   * Which end of the thread page 1 sits at.
   *
   * GitHub ignores `direction` on the comments endpoints, so this is applied
   * client-side rather than trusted from the server.
   */
  direction?: 'first' | 'last'
}

export interface ReactionTarget {
  commentId: number
  nodeId: string | null
  /**
   * Whether the viewer has already reacted **with the `content` being
   * passed** — the caller resolves this per reaction type, because a viewer
   * can hold one of each of the eight types on the same comment.
   */
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
  /**
   * Anonymous-capable GraphQL read through the configured proxy.
   *
   * Returns `null` when the proxy cannot serve the read (not configured, no
   * installation token, private repository, network failure, GraphQL error).
   * Backends treat that as "use the REST fallback", never as a hard failure:
   * the accelerated path must not make an unconfigured or misconfigured proxy
   * worse than the 60/hr browser limit it replaces.
   *
   * Deliberately separate from `graphql`, which is the visitor-token path used
   * by mutations and by signed-in viewers.
   */
  proxyRead?: <T>(
    body: { query: string; variables: Record<string, unknown> },
    options?: { fresh?: boolean }
  ) => Promise<T | null>
}

/** The `PageInfo` fields both comment connections expose. */
export interface GraphqlPageInfo {
  hasNextPage?: boolean
  hasPreviousPage?: boolean
  startCursor?: string | null
  endCursor?: string | null
}

/** One `ReactionGroup` in a read response. */
export interface GraphqlReactionGroup {
  content: Reaction
  viewerHasReacted?: boolean
  reactors?: { totalCount?: number } | null
}

/** A comment node as returned by the anonymous read queries. */
export interface GraphqlReadComment {
  id: string
  databaseId?: number | null
  author?: unknown
  createdAt: string
  url: string
  bodyHTML?: string | null
  reactionGroups?: GraphqlReactionGroup[] | null
  replies?: {
    totalCount?: number
    nodes?: GraphqlReadComment[] | null
  } | null
}

/** A comment connection as returned by the anonymous read queries. */
export interface GraphqlReadCommentConnection {
  totalCount?: number
  pageInfo?: GraphqlPageInfo | null
  nodes?: GraphqlReadComment[] | null
}

export const GHOST_USER: GitalkUser = {
  login: 'ghost',
  avatarUrl: 'https://avatars.githubusercontent.com/u/10137?v=4',
  htmlUrl: 'https://github.com/ghost'
}

/**
 * Sentinel for {@link BaseBackend.lastPageByQuery}: this collection reports
 * neither a comment count nor a `Link` header, so pages can only be walked in
 * the server's own order.
 */
const FORWARD_ONLY = 0

/**
 * Map GitHub's REST reaction field names onto {@link Reaction}.
 *
 * REST reports the eight `ReactionContent` values under these keys (note the
 * two punctuated ones), which is the only place the widget can get a per-type
 * breakdown from without a GraphQL round trip.
 */
const REST_REACTION_KEYS: Record<Reaction, string> = {
  THUMBS_UP: '+1',
  THUMBS_DOWN: '-1',
  LAUGH: 'laugh',
  HOORAY: 'hooray',
  CONFUSED: 'confused',
  HEART: 'heart',
  ROCKET: 'rocket',
  EYES: 'eyes'
}

/**
 * Normalise a REST `reactions` object into {@link GitalkReactions}.
 *
 * REST carries per-type counts but no viewer state (there is no viewer on an
 * anonymous read), so `viewerReactions` comes back empty; the widget fills it
 * in later with {@link fetchReactionStates} when someone is signed in.
 * `total_count` is authoritative when present; otherwise the per-type counts
 * are summed so the total can never disagree with the breakdown next to it.
 */
export function reactionsFromRest(raw: Record<string, unknown> | undefined | null): GitalkReactions {
  const counts: ReactionCounts = {}
  let sum = 0

  for (const content of REACTIONS) {
    const value = raw?.[REST_REACTION_KEYS[content]]
    const n = typeof value === 'number' ? value : 0
    if (n > 0) counts[content] = n
    sum += n
  }

  const reported = raw?.['total_count']
  const totalCount = typeof reported === 'number' ? reported : sum

  return { totalCount, viewerHasReacted: false, counts, viewerReactions: {} }
}

/**
 * One GraphQL request that answers "who reacted with what" for a whole page of
 * comments.
 *
 * `nodes(ids:)` takes up to 100 ids and returns `Node.id`, so results are
 * matched back by id rather than by position. The `Reactable` fragment covers
 * both `DiscussionComment` and `IssueComment`; objects that do not implement
 * it come back without `reactionGroups` instead of erroring.
 */
export const REACTION_STATES_QUERY = `
query gitalkReactionStates($ids: [ID!]!) {
  nodes(ids: $ids) {
    id
    ... on Reactable {
      reactionGroups {
        content
        viewerHasReacted
        reactors(first: 0) { totalCount }
      }
    }
  }
}`

/** GitHub caps `nodes(ids:)` at 100 ids per request. */
export const REACTION_STATE_BATCH = 100

/** Turn GraphQL `reactionGroups` into per-type counts plus viewer flags. */
export function reactionsFromGroups(
  groups:
    | Array<{
        content: Reaction
        viewerHasReacted?: boolean
        reactors?: { totalCount?: number } | null
      }>
    | null
    | undefined
): ReactionState {
  const counts: ReactionCounts = {}
  const viewerReactions: ReactionFlags = {}

  for (const group of groups ?? []) {
    if (!REACTIONS.includes(group.content)) continue
    const count = group.reactors?.totalCount ?? 0
    if (count > 0) counts[group.content] = count
    if (group.viewerHasReacted) viewerReactions[group.content] = true
  }

  return { counts, viewerReactions }
}

/** One entry of the `nodes(ids:)` response above. */
export interface ReactionStateNode {
  id: string
  reactionGroups?: Array<{
    content: Reaction
    viewerHasReacted?: boolean
    reactors?: { totalCount?: number } | null
  }> | null
}

/**
 * Fetch per-type reaction state for a batch of comment node ids.
 *
 * Shared by both backends: the document and the normalisation are the same,
 * only the transport differs (GraphQL routed through the proxy, or the REST
 * client's `/graphql` POST). Anonymous viewers get an empty map without a
 * request — there is no viewer to ask about, and GraphQL refuses them.
 */
export async function fetchReactionStates(
  ctx: BackendContext,
  nodeIds: string[],
  request: (
    query: string,
    variables: Record<string, unknown>
  ) => Promise<{ nodes?: ReactionStateNode[] | null }>
): Promise<Map<string, ReactionState>> {
  const out = new Map<string, ReactionState>()
  const ids = nodeIds.filter((id): id is string => Boolean(id)).slice(0, REACTION_STATE_BATCH)
  if (!ctx.getToken() || !ids.length) return out

  const data = await request(REACTION_STATES_QUERY, { ids })
  for (const node of data?.nodes ?? []) {
    if (!node?.id) continue
    out.set(node.id, reactionsFromGroups(node.reactionGroups))
  }
  return out
}

/** Rest-of-the-thread ordering, applied client-side because GitHub ignores it. */export function sortComments(
  comments: GitalkComment[],
  direction: 'first' | 'last'
): GitalkComment[] {
  const sign = direction === 'first' ? 1 : -1

  // Replies keep reading order (oldest first) whatever the top-level order is:
  // a reply thread is a conversation and reversing it would be nonsense.
  for (const comment of comments) {
    comment.replies?.sort((a, b) => createdAtMs(a.createdAt) - createdAtMs(b.createdAt))
  }

  return [...comments].sort((a, b) => sign * (createdAtMs(a.createdAt) - createdAtMs(b.createdAt)))
}

/** Epoch milliseconds, with unparseable dates sinking to the epoch. */
function createdAtMs(value: string): number {
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? 0 : ms
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

  /**
   * Issues have no upvote concept at all, so the capability defaults to off
   * and only the Discussions backend turns it on.
   */
  readonly supportsUpvote: boolean = false

  constructor(protected readonly ctx: BackendContext) {}

  abstract resolveThread(opts: ResolveOptions): Promise<ThreadInfo | null>
  abstract createThread(): Promise<ThreadInfo | null>
  abstract getComments(opts: PageOptions): Promise<ThreadPage>
  abstract addComment(body: string, replyTo?: number): Promise<GitalkComment | GitalkReply>
  abstract toggleReaction(target: ReactionTarget, content: Reaction): Promise<void>

  /**
   * Reaction state is opt-in: the base class reports "unknown" and the
   * backends that can ask GraphQL override this.
   */
  async getReactionStates(_nodeIds: string[]): Promise<Map<string, ReactionState>> {
    return new Map()
  }

  /** No upvotes by default; Discussions overrides this. */
  async getUpvote(): Promise<UpvoteState | null> {
    return null
  }

  /** Throws rather than silently no-oping, so a programming error is visible. */
  async setUpvote(_on = false): Promise<void> {
    throw new GitalkError(
      `Upvotes are only available for GitHub Discussions (this widget uses the \`${this.kind}\` backend)`
    )
  }

  preview(body: string): Promise<string> {
    return renderMarkdown(body, this.ctx.getToken())
  }

  protected threadNumber(): number {
    const thread = this.ctx.getThread()
    if (!thread) throw new Error('Thread has not been resolved yet')
    return thread.number
  }

  /**
   * Last offset page seen for a comments collection, keyed by path+size.
   *
   * Populated from the `Link` header (or the thread's comment count) so the
   * newest-first view can jump straight to the end of the list instead of
   * paging all the way through it.
   */
  private readonly lastPageByQuery = new Map<string, number>()

  /**
   * Read one page of a REST comments collection, resolving the logical page to
   * a real offset page.
   *
   * Why this exists: **GitHub's comment endpoints ignore the `direction`
   * query parameter.** Verified against api.github.com — `/issues/1/comments`
   * and `/discussions/442/comments` return byte-identical ascending payloads
   * for `direction=asc`, `direction=desc` and no parameter at all — so a
   * newest-first UI cannot be built by asking the server; it has to (a) derive
   * the order itself and (b) start from the *end* of the ascending feed.
   *
   * For `direction: 'last'`, logical page 1 is therefore mapped onto the last
   * server page, page 2 onto the one before it, and so on. The last page comes
   * from `ThreadInfo.commentCount` when the transport reported it, and is
   * otherwise probed once from the `Link` header of page 1. When neither is
   * available — a proxy that strips both, say — it degrades to offset paging
   * in the server's own order rather than pretending to know where the end is.
   */
  protected async readCommentPage<T>(opts: {
    path: string
    perPage: number
    direction: 'first' | 'last'
    page: number
    fresh?: boolean
    totalCount?: number | null
  }): Promise<{ items: T[]; hasNextPage: boolean; hasPreviousPage: boolean }> {
    const { path, perPage, direction, fresh } = opts
    const logical = Math.max(opts.page, 1)
    const cacheKey = `${path}#per_page=${perPage}`
    const load = (serverPage: number) =>
      this.ctx.http.getWithLinks<T[]>(
        `${path}?per_page=${perPage}&page=${serverPage}`,
        fresh ? { cache: 'reload' } : undefined
      )

    if (direction === 'first') {
      const { data, links } = await load(logical)
      return {
        items: data,
        hasNextPage: links.next != null || data.length >= perPage,
        hasPreviousPage: logical > 1
      }
    }

    // A `fresh` read follows a write, which means both the cached page number
    // and `ThreadInfo.commentCount` predate the new comment. Trusting either
    // would answer with the *previous* last page and hide the newest comments,
    // so the end of the list is re-probed from the network instead.
    if (fresh) this.lastPageByQuery.delete(cacheKey)

    let lastPage = fresh ? null : (this.lastPageByQuery.get(cacheKey) ?? null)
    if (lastPage == null && !fresh && opts.totalCount != null) {
      lastPage = Math.max(1, Math.ceil(opts.totalCount / perPage))
    }

    // Nothing reported how long the thread is and this collection's Link
    // header has never been seen: ask for page 1 and read it. This is the only
    // path that costs an extra request, and it is the rare one.
    if (lastPage == null) {
      const probe = await load(1)
      if (probe.links.last == null) {
        // The transport reports neither a count nor a Link header, so the end
        // of the list is unknowable. Fall back to offset paging (and remember
        // that decision, or every later page would probe again).
        this.lastPageByQuery.set(cacheKey, FORWARD_ONLY)
        return {
          items: probe.data,
          hasNextPage: probe.data.length >= perPage,
          hasPreviousPage: false
        }
      }
      if (probe.links.last <= 1) {
        // Single-page thread: the response in hand is the whole list.
        return { items: probe.data, hasNextPage: false, hasPreviousPage: false }
      }
      lastPage = probe.links.last
      this.lastPageByQuery.set(cacheKey, lastPage)
    }

    if (lastPage === FORWARD_ONLY) {
      const { data, links } = await load(logical)
      return {
        items: data,
        hasNextPage: links.next != null || data.length >= perPage,
        hasPreviousPage: logical > 1
      }
    }

    const serverPage = Math.max(1, lastPage - logical + 1)
    let { data, links } = await load(serverPage)
    if (links.last != null) this.lastPageByQuery.set(cacheKey, links.last)

    // The count can be stale (someone deleted a comment between the thread
    // lookup and this read), which would leave the first screen empty. One
    // step back finds the newest page that still exists.
    if (!data.length && serverPage > 1) {
      const retry = await load(serverPage - 1)
      data = retry.data
      links = retry.links
    }

    return {
      items: data,
      hasNextPage: serverPage > 1,
      hasPreviousPage: serverPage < lastPage
    }
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
