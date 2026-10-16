import type { PageOptions, ReactionState, ReactionTarget } from './backend'
import type { ReactionStateNode } from './backend'
import { BaseBackend, fetchReactionStates, reactionsFromRest, sortComments } from './backend'
import type { GitalkComment, GitalkReply, Reaction, ThreadInfo, ThreadPage } from '../types'
import { GitalkError } from './client'

interface RawIssue {
  number: number
  node_id: string
  title: string
  html_url: string
  locked: boolean
  labels: Array<{ name: string }>
  comments?: number
}

interface RawComment {
  id: number
  node_id: string
  user: unknown
  body_html?: string
  created_at: string
  html_url: string
  reactions?: Record<string, unknown>
}

const CREATE_ISSUE_COMMENT = `
mutation addComment($subjectId: ID!, $body: String!) {
  addComment(input: { subjectId: $subjectId, body: $body }) {
    commentEdge { node { id databaseId bodyHTML createdAt url } }
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

export interface IssuesBackendOptions {
  labels: string[]
  title: string
  body: string
}

/**
 * Issues-backed comment store: the Gitalk v1 storage model, retained for
 * backwards compatibility.
 *
 * Note the historical constraint that motivates moving to Discussions: v1
 * encoded the page id into an issue *label*, and GitHub caps label names at
 * 50 characters (root cause of gitalk/gitalk#423). Labels in 2.0 are still
 * supported but the page id must therefore be kept short.
 */
export class IssuesBackend extends BaseBackend {
  readonly kind = 'issues' as const

  constructor(ctx: ConstructorParameters<typeof BaseBackend>[0], private readonly opts: IssuesBackendOptions) {
    super(ctx)
  }

  async resolveThread({ number, term }: { number?: number; term: string }): Promise<ThreadInfo | null> {
    if (typeof number === 'number' && number > 0) {
      const direct = await this.fetchByNumber(number)
      if (direct) return direct
    }
    return this.findByLabel(term)
  }

  private async fetchByNumber(number: number): Promise<ThreadInfo | null> {
    try {
      const issue = await this.ctx.http.get<RawIssue>(
        `/repos/${this.ctx.owner}/${this.ctx.repo}/issues/${number}`
      )
      return this.toThreadInfo(issue)
    } catch (err) {
      if (isNotFound(err)) return null
      throw err
    }
  }

  /**
   * Issues are indexed by label, and unlike Discussions this lookup is a
   * single cheap REST call — the search index covers issues, and the labels
   * filter works anonymously (verified). This is the v1 strategy and it still
   * works today.
   */
  private async findByLabel(term: string): Promise<ThreadInfo | null> {
    const labels = [...this.opts.labels, term].map(encodeURIComponent).join(',')
    const issues = await this.ctx.http.get<RawIssue[]>(
      `/repos/${this.ctx.owner}/${this.ctx.repo}/issues?labels=${labels}&state=all&per_page=1`
    )
    const hit = issues[0]
    return hit ? this.toThreadInfo(hit) : null
  }

  async createThread(): Promise<ThreadInfo | null> {
    const issue = await this.ctx.http.post<RawIssue>(
      `/repos/${this.ctx.owner}/${this.ctx.repo}/issues`,
      {
        title: this.opts.title,
        body: this.opts.body,
        labels: [...this.opts.labels, this.ctx.term()]
      }
    )
    return this.toThreadInfo(issue)
  }

  async getComments({ first, direction, page, fresh }: PageOptions): Promise<ThreadPage> {
    const thread = this.ctx.getThread()
    if (!thread) throw new GitalkError('Thread has not been resolved yet')

    const perPage = Math.min(Math.max(first, 1), 100)
    const currentPage = Math.max(page ?? 1, 1)
    const order = direction === 'first' ? 'first' : 'last'

    // Same story as the Discussions backend: `direction` is ignored by the
    // endpoint (verified against api.github.com), so the order is applied
    // client-side and the newest-first window comes from the last page.
    const { items: raw, hasNextPage, hasPreviousPage } = await this.readCommentPage<RawComment>({
      path: `/repos/${this.ctx.owner}/${this.ctx.repo}/issues/${thread.number}/comments`,
      perPage,
      direction: order,
      page: currentPage,
      fresh,
      totalCount: thread.commentCount
    })

    const comments: GitalkComment[] = raw.map((item) => ({
      id: item.id,
      nodeId: item.node_id ?? null,
      user: this.normalizeUser(item.user),
      bodyHtml: item.body_html ?? '',
      createdAt: item.created_at,
      htmlUrl: item.html_url,
      reactions: reactionsFromRest(item.reactions),
      isAuthor: false,
      // Issues have no threading, so replies are always empty.
      replies: []
    }))

    const ordered = sortComments(comments, order)
    const head = ordered[0]
    return {
      comments: ordered,
      totalCount: thread.commentCount ?? ordered.length,
      hasNextPage,
      hasPreviousPage,
      endCursor: head ? String(head.id) : null,
      startCursor: head ? String(head.id) : null,
      page: currentPage
    }
  }

  /**
   * Post a comment.
   *
   * `replyTo` is accepted for interface parity but deliberately ignored:
   * Issues have no threading model, so there is no parent to attach to. The
   * UI hides the reply control on this backend; this guard is only here so a
   * direct caller cannot silently end up with a mis-nested list.
   */
  async addComment(body: string, replyTo?: number): Promise<GitalkComment | GitalkReply> {
    const thread = this.ctx.getThread()
    if (!thread) throw new GitalkError('Thread has not been resolved yet')
    if (replyTo != null) {
      throw new GitalkError('Issues have no threaded replies; post a top-level comment instead')
    }

    const created = await this.ctx.http.post<RawComment>(
      `/repos/${this.ctx.owner}/${this.ctx.repo}/issues/${thread.number}/comments`,
      { body }
    )

    return {
      id: created.id,
      nodeId: created.node_id ?? null,
      user: this.normalizeUser(created.user),
      bodyHtml: created.body_html ?? '',
      createdAt: created.created_at,
      htmlUrl: created.html_url,
      reactions: reactionsFromRest(created.reactions),
      isAuthor: true,
      replies: []
    }
  }

  async toggleReaction(target: ReactionTarget, content: Reaction): Promise<void> {
    if (!target.nodeId) throw new GitalkError('Cannot react: missing GraphQL node id')
    if (!this.ctx.getToken()) throw new GitalkError('Log in with GitHub to react', 401)

    const response = await this.ctx.http.post<{
      data?: unknown
      errors?: Array<{ message: string }>
    }>('/graphql', {
      query: target.viewerHasReacted ? REMOVE_REACTION : ADD_REACTION,
      variables: { subjectId: target.nodeId, content }
    })

    if (response.errors?.length) {
      throw new GitalkError(response.errors.map((e) => e.message).join(', '))
    }
  }

  /**
   * Per-type reaction state, same GraphQL document the Discussions backend
   * uses (`Reactable` is implemented by both comment types).
   *
   * Issues have no upvotes, but they do have reactions — and the REST read
   * cannot report which ones belong to the viewer, so this is the only way the
   * picker can highlight them after a reload.
   */
  override async getReactionStates(nodeIds: string[]): Promise<Map<string, ReactionState>> {
    return fetchReactionStates(this.ctx, nodeIds, async (query, variables) => {
      const response = await this.ctx.graphql<{
        data?: { nodes?: ReactionStateNode[] | null }
        errors?: Array<{ message: string }>
      }>({ query, variables })

      if (response.errors?.length) {
        throw new GitalkError(response.errors.map((e) => e.message).join(', '))
      }
      return response.data ?? {}
    })
  }

  private toThreadInfo(issue: RawIssue): ThreadInfo {
    return {
      kind: 'issues',
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      nodeId: issue.node_id ?? null,
      locked: issue.locked ?? false,
      commentCount: issue.comments
    }
  }
}

/**
 * Structural rather than `instanceof`, since errors may cross bundle
 * boundaries where class identity is not preserved.
 */
function isNotFound(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'status' in err && (err as { status?: unknown }).status === 404)
}
