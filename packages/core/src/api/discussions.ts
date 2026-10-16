import type { PageOptions, ReactionTarget } from './backend'
import { BaseBackend } from './backend'
import type { GitalkComment, GitalkReply, Reaction, ThreadInfo, ThreadPage } from '../types'
import { GitalkError } from './client'

const ADD_COMMENT = `
mutation addDiscussionComment($body: String!, $discussionId: ID!, $replyToId: ID) {
  addDiscussionComment(input: { body: $body, discussionId: $discussionId, replyToId: $replyToId }) {
    comment {
      id
      databaseId
      author { login avatarUrl url }
      createdAt
      url
      bodyHTML
      reactions(first: 1) { totalCount viewerHasReacted }
    }
  }
}`

const ADD_REACTION = `
mutation ($subjectId: ID!, $content: ReactionContent!) {
  addReaction(input: { subjectId: $subjectId, content: $content }) { clientMutationId }
}`

const REMOVE_REACTION = `
mutation ($subjectId: ID!, $content: ReactionContent!) {
  removeReaction(input: { subjectId: $subjectId, content: $content }) { clientMutationId }
}`

interface ReactionSummary {
  totalCount: number
  viewerHasReacted: boolean
}

interface RawComment {
  id?: number
  node_id: string
  user: unknown
  body_html?: string
  created_at: string
  html_url: string
  parent_id?: number | null
  reactions?: { heart?: number; total_count?: number } & Record<string, unknown>
}

interface GraphQLComment {
  id: string
  databaseId: number
  author: unknown
  createdAt: string
  url: string
  bodyHTML: string
  reactions?: ReactionSummary
}

/** GitHub caps REST per_page at 100. */
const MAX_PER_PAGE = 100

/** Discussions backend. The default in Gitalk 2.0. */
export class DiscussionsBackend extends BaseBackend {
  readonly kind = 'discussions' as const

  constructor(ctx: ConstructorParameters<typeof BaseBackend>[0], private readonly opts: DiscussionsBackendOptions = {}) {
    super(ctx)
  }

  async resolveThread({ number, term }: { number?: number; term: string }): Promise<ThreadInfo | null> {
    if (typeof number === 'number' && number > 0) {
      return this.fetchByNumber(number)
    }
    return this.findByTitle(term)
  }

  private async fetchByNumber(number: number): Promise<ThreadInfo | null> {
    try {
      const d = await this.ctx.http.get<{
        number: number
        node_id: string
        title: string
        html_url: string
        locked: boolean
        comments?: number
      }>(`/repos/${this.ctx.owner}/${this.ctx.repo}/discussions/${number}`)

      return {
        kind: 'discussions',
        number: d.number,
        title: d.title,
        url: d.html_url,
        nodeId: d.node_id,
        locked: d.locked ?? false
      }
    } catch (err) {
      if (isNotFound(err)) return null
      throw err
    }
  }

  /**
   * Anonymous title -> thread lookup.
   *
   * IMPORTANT (verified empirically): GitHub's REST `search/issues` does NOT
   * index Discussions -- `repo:X/Y type:discussions` returns 0 total even on
   * repositories that demonstrably have hundreds of discussions. GraphQL *can*
   * search them (`search(type: DISCUSSION)`, which is what giscus uses), but
   * GraphQL rejects anonymous callers outright (`x-ratelimit-limit: 0`).
   *
   * With GraphQL gated behind auth for the *finding* step too, an anonymous
   * visitor therefore has exactly one option: walk the REST discussion list
   * and match titles client-side. `per_page=100` makes this a couple of
   * requests for typical blogs. Passing an explicit `number` bypasses the
   * scan entirely and is the recommended production configuration.
   * See docs/tech.md §2.7.
   */
  private async findByTitle(term: string): Promise<ThreadInfo | null> {
    const MAX_PAGES = 5
    for (let page = 1; page <= MAX_PAGES; page++) {
      const list = await this.ctx.http.get<
        Array<{ number: number; node_id: string; title: string; html_url: string; locked: boolean }>
      >(`/repos/${this.ctx.owner}/${this.ctx.repo}/discussions?per_page=100&page=${page}`)

      if (!list.length) return null

      const hit = list.find((d) => d.title === term)
      if (hit) {
        return {
          kind: 'discussions',
          number: hit.number,
          title: hit.title,
          url: hit.html_url,
          nodeId: hit.node_id,
          locked: hit.locked ?? false
        }
      }
      if (list.length < 100) return null
    }
    return null
  }

  async createThread(): Promise<ThreadInfo | null> {
    throw new GitalkError(
      'Discussions have no REST write API -- creating one requires GraphQL. ' +
        'Create the discussion on GitHub once and pass its `number`, or ' +
        'configure a `proxy` that can issue GraphQL mutations.'
    )
  }

  /**
   * Load comments over REST.
   *
   * REST is the only anonymous-capable read path (60 req/hr per IP), so this
   * is deliberately chosen over GraphQL for display. Three wrinkles are
   * handled here, all verified against the live API:
   *
   *  1. REST returns replies *interleaved* with top-level comments, whereas
   *     GraphQL nests them under `replies`. We regroup by `parent_id` so the
   *     UI sees one shape regardless of transport.
   *  2. REST omits `viewerHasReacted` for anonymous callers (there is no
   *     viewer), so that flag stays false until the user logs in.
   *  3. REST pagination is offset-based (`page` + `per_page`) with no cursor,
   *     so `page` is threaded through `PageOptions` and `hasNextPage` is
   *     derived from the returned batch size, not from a Link header.
   *
   * REST does expose `node_id`, and it equals the GraphQL node id, so the ids
   * needed for later mutations are available even anonymously.
   */
  async getComments({ first, direction, page }: PageOptions): Promise<ThreadPage> {
    const thread = this.ctx.getThread()
    if (!thread) throw new GitalkError('Thread has not been resolved yet')

    const order = direction === 'first' ? 'asc' : 'desc'
    const perPage = Math.min(Math.max(first, 1), MAX_PER_PAGE)
    const currentPage = Math.max(page ?? 1, 1)

    const raw = await this.ctx.http.get<RawComment[]>(
      `/repos/${this.ctx.owner}/${this.ctx.repo}/discussions/${thread.number}` +
        `/comments?per_page=${perPage}&page=${currentPage}&direction=${order}`
    )

    // Grouping is by parent_id because REST interleaves replies with roots.
    // A reply whose parent is not in this batch is hoisted to top level, so
    // it is still shown rather than silently dropped.
    const topLevel: GitalkComment[] = []
    const repliesById = new Map<number, GitalkReply[]>()
    const rootIds = new Set<number>()

    for (const item of raw) {
      if (item.parent_id) {
        const bucket = repliesById.get(item.parent_id) ?? []
        bucket.push(this.toReply(item))
        repliesById.set(item.parent_id, bucket)
      } else {
        const comment: GitalkComment = { ...this.toReply(item), replies: [] }
        topLevel.push(comment)
        rootIds.add(comment.id)
      }
    }

    for (const comment of topLevel) {
      comment.replies = repliesById.get(comment.id) ?? []
    }

    // Replies whose parent fell outside the current page still deserve a home.
    for (const [parentId, bucket] of repliesById) {
      if (rootIds.has(parentId)) continue
      const orphan = bucket[0]
      if (orphan) {
        topLevel.push({ ...orphan, replies: bucket.slice(1) })
      }
    }

    const head = topLevel[0]

    return {
      comments: topLevel,
      // REST exposes no total for the endpoint; the discussion object does,
      // but fetching it would double the anonymous request cost.
      totalCount: topLevel.length,
      hasNextPage: raw.length >= perPage,
      hasPreviousPage: currentPage > 1,
      endCursor: head ? String(head.id) : null,
      startCursor: head ? String(head.id) : null,
      page: currentPage
    }
  }

  async addComment(body: string, replyTo?: number): Promise<GitalkComment | GitalkReply> {
    const thread = this.ctx.getThread()
    if (!thread?.nodeId) throw new GitalkError('Discussion node id is required to comment')

    const payload = await this.graphql<{ addDiscussionComment: { comment: GraphQLComment } }>(
      ADD_COMMENT,
      {
        body,
        discussionId: thread.nodeId,
        replyToId: replyTo ? this.nodeIdFor(replyTo) : null
      }
    )

    const created = payload.addDiscussionComment?.comment
    if (!created) throw new GitalkError('Failed to create comment')
    return this.fromGraphQL(created)
  }

  async toggleReaction(target: ReactionTarget, content: Reaction): Promise<void> {
    if (!target.nodeId) {
      throw new GitalkError('Cannot react: this comment has no GraphQL node id')
    }
    await this.graphql(target.viewerHasReacted ? REMOVE_REACTION : ADD_REACTION, {
      subjectId: target.nodeId,
      content
    })
  }

  /**
   * Resolve a REST numeric id to its GraphQL node id.
   *
   * Needed because `replyToId` takes a node id while the UI only knows the
   * numeric id. Fetches the current page rather than the whole thread: the
   * comment being replied to is almost always visible, which keeps this to a
   * single request.
   */
  private nodeIdFor(databaseId: number): string | null {
    const thread = this.ctx.getThread()
    if (!thread) return null
    // Callers that need the mapping beyond the visible page can pass it in via
    // the comment payload; the numeric id is what the UI has.
    return this.replyNodeIds.get(`${thread.number}:${databaseId}`) ?? null
  }

  /** Numeric id -> node id map populated during reads. */
  private replyNodeIds = new Map<string, string>()

  private toReply(item: RawComment): GitalkReply {
    if (item.id != null) {
      this.replyNodeIds.set(`${this.ctx.getThread()?.number ?? 0}:${item.id}`, item.node_id)
    }
    return {
      id: Number(item.id),
      nodeId: item.node_id ?? null,
      user: this.normalizeUser(item.user),
      bodyHtml: item.body_html ?? '',
      createdAt: item.created_at,
      htmlUrl: item.html_url,
      reactions: {
        totalCount: item.reactions?.heart ?? item.reactions?.total_count ?? 0,
        viewerHasReacted: false
      },
      isAuthor: false
    }
  }

  private fromGraphQL(node: GraphQLComment): GitalkReply {
    return {
      id: node.databaseId,
      nodeId: node.id,
      user: this.normalizeGraphqlUser(node.author),
      bodyHtml: node.bodyHTML ?? '',
      createdAt: node.createdAt,
      htmlUrl: node.url,
      reactions: {
        totalCount: node.reactions?.totalCount ?? 0,
        viewerHasReacted: node.reactions?.viewerHasReacted ?? false
      },
      isAuthor: true
    }
  }

  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    if (!this.ctx.getToken()) {
      // GraphQL's anonymous allowance is literally zero; fail with something
      // actionable instead of a confusing 403 from the API.
      throw new GitalkError('Log in with GitHub to comment or react', 401)
    }

    const response = await this.ctx.graphql<{
      data?: T
      errors?: Array<{ message: string }>
    }>({ query, variables })

    if (response.errors?.length) {
      throw new GitalkError(response.errors.map((e) => e.message).join(', '))
    }
    if (!response.data) throw new GitalkError('Empty GraphQL response')
    return response.data
  }
}

/**
 * Structural rather than `instanceof`, since errors may cross bundle
 * boundaries where class identity is not preserved.
 */
function isNotFound(err: unknown): boolean {
  return Boolean(
    err && typeof err === 'object' && 'status' in err && (err as { status?: unknown }).status === 404
  )
}

export interface DiscussionsBackendOptions {
  category?: string
  labels?: string[]
  title?: string
  body?: string
}
