import type { PageOptions, ReactionState, ReactionTarget } from './backend'
import {
  BaseBackend,
  fetchReactionStates,
  reactionsFromGroups,
  reactionsFromRest,
  sortComments
} from './backend'
import type { ReactionStateNode } from './backend'
import type {
  GitalkComment,
  GitalkReply,
  Reaction,
  ThreadInfo,
  ThreadPage,
  UpvoteState
} from '../types'
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
      reactionGroups { content viewerHasReacted reactors(first: 0) { totalCount } }
    }
  }
}`

/**
 * Thread-level upvote state.
 *
 * `upvoteCount` / `viewerHasUpvoted` live on the GraphQL `Discussion` type
 * only — the REST discussion object reports reactions but says nothing about
 * upvotes — so this is fetched separately and only for signed-in viewers
 * (GraphQL's anonymous quota is literally zero).
 */
const DISCUSSION_UPVOTE = `
query gitalkDiscussionUpvote($id: ID!) {
  node(id: $id) {
    ... on Discussion {
      upvoteCount
      viewerHasUpvoted
    }
  }
}`

const ADD_UPVOTE = `
mutation gitalkAddUpvote($subjectId: ID!) {
  addUpvote(input: { subjectId: $subjectId }) { clientMutationId }
}`

const REMOVE_UPVOTE = `
mutation gitalkRemoveUpvote($subjectId: ID!) {
  removeUpvote(input: { subjectId: $subjectId }) { clientMutationId }
}`

/**
 * Resolve the two ids `createDiscussion` needs, plus the information required
 * to explain a failure.
 *
 * `CreateDiscussionInput.repositoryId` and `.categoryId` are both `ID!`, so
 * neither can be omitted and neither is derivable from the REST endpoint
 * (REST exposes the repository's `node_id`, but no category ids at all).
 * `hasDiscussionsEnabled` is the difference between "repo never turned
 * Discussions on" and "wrong category", which are two different fixes for the
 * operator, so it is worth one extra field.
 *
 * Verified against the published schema:
 *   https://docs.github.com/en/graphql/reference/repos#discussioncategories
 *   https://docs.github.com/en/graphql/reference/discussions
 */
const RESOLVE_CREATION_TARGET = `
query gitalkDiscussionTarget($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    id
    hasDiscussionsEnabled
    discussionCategories(first: 100) { nodes { id name slug } }
  }
}`

/**
 * The only way to create a discussion: GraphQL `createDiscussion`.
 *
 * There is no REST equivalent (POST /repos/{owner}/{repo}/discussions does not
 * exist), which is why the Discussions backend cannot reuse the Issues
 * backend's `POST /issues`. Input fields and payload per the official
 * reference:
 *   https://docs.github.com/en/graphql/reference/mutations#creatediscussion
 *
 * The `discussion` payload carries `number`, which is what the REST comment
 * reads below need, and `id`, which later comment mutations need.
 */
const CREATE_DISCUSSION = `
mutation gitalkCreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
  createDiscussion(input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body }) {
    discussion {
      id
      number
      title
      url
      locked
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

interface RawComment {
  id?: number
  node_id: string
  user: unknown
  body_html?: string
  created_at: string
  html_url: string
  parent_id?: number | null
  reactions?: Record<string, unknown>
}

/**
 * One entry of a GraphQL `ReactionGroup`.
 *
 * `reactors(first: 0)` is how the group reports its size: `ReactionGroup` has
 * no `totalCount` of its own, and asking for zero reactors keeps the response
 * to a number instead of a list of users.
 */
interface GraphQLReactionGroup {
  content: Reaction
  viewerHasReacted: boolean
  reactors?: { totalCount?: number } | null
}

interface GraphQLComment {
  id: string
  databaseId: number
  author: unknown
  createdAt: string
  url: string
  bodyHTML: string
  reactionGroups?: GraphQLReactionGroup[] | null
}

/** A row of `Repository.discussionCategories`. */
interface DiscussionCategoryNode {
  id: string
  name: string
  slug: string
}

interface CreationTargetData {
  repository: {
    id: string
    hasDiscussionsEnabled: boolean
    discussionCategories?: { nodes?: DiscussionCategoryNode[] } | null
  } | null
}

/** The slice of the `Discussion` type the widget needs to start working. */
interface GraphQLDiscussion {
  id: string
  number: number
  title: string
  url: string
  locked: boolean
}

interface CreateDiscussionData {
  createDiscussion: { discussion: GraphQLDiscussion | null } | null
}

/**
 * One entry of a GraphQL `errors` array. `type` is GitHub's coarse error code
 * (`FORBIDDEN`, `NOT_FOUND`, `UNPROCESSABLE`, ...) and is what makes it
 * possible to tell a permission problem from a bad category.
 */
interface GraphQLError {
  message: string
  type?: string
}

/** GitHub caps REST per_page at 100. */
const MAX_PER_PAGE = 100

/** Discussions backend. The default in Gitalk 2.0. */
export class DiscussionsBackend extends BaseBackend {
  readonly kind = 'discussions' as const

  /** GraphQL upvotes exist on Discussions (and nowhere else in this widget). */
  override readonly supportsUpvote = true

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
        locked: d.locked ?? false,
        commentCount: d.comments
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
    // Two titles can legitimately address this page, because the creation
    // path below titles the discussion with `opts.title` (the human-readable
    // one) while `term` is the page id. Matching only `term` would mean a
    // discussion Gitalk just created is invisible on the next page load — and
    // with `createIssueManually: false` every visitor would then auto-create
    // yet another duplicate. Matching either keeps create -> revisit working.
    const titles = new Set([term, this.opts.title].filter((t): t is string => Boolean(t)))

    const MAX_PAGES = 5
    for (let page = 1; page <= MAX_PAGES; page++) {
      const list = await this.ctx.http.get<
        Array<{
          number: number
          node_id: string
          title: string
          html_url: string
          locked: boolean
          comments?: number
        }>
      >(`/repos/${this.ctx.owner}/${this.ctx.repo}/discussions?per_page=100&page=${page}`)

      if (!list.length) return null

      const hit = list.find((d) => titles.has(d.title))
      if (hit) {
        return {
          kind: 'discussions',
          number: hit.number,
          title: hit.title,
          url: hit.html_url,
          nodeId: hit.node_id,
          locked: hit.locked ?? false,
          commentCount: hit.comments
        }
      }
      if (list.length < 100) return null
    }
    return null
  }

  /**
   * Create this page's discussion with the GraphQL `createDiscussion`
   * mutation.
   *
   * Verification status: the query, the input fields and the payload fields
   * all come from GitHub's published schema and reference pages (links on
   * `RESOLVE_CREATION_TARGET` / `CREATE_DISCUSSION` above); the behaviour of
   * every failure branch is pinned by unit tests with a stubbed transport.
   * What has NOT been exercised here is a real round trip to api.github.com,
   * because that needs a token with write access to a repository that has
   * Discussions enabled.
   *
   * The returned `ThreadInfo` carries both ids the widget needs next: `number`
   * for the anonymous REST comment reads and `nodeId` for comment mutations,
   * so the component can go straight from creation to posting a comment.
   */
  async createThread(): Promise<ThreadInfo | null> {
    // GraphQL has a literally-zero anonymous quota, so an unauthenticated
    // attempt could only ever produce a confusing 401 upstream. Fail with the
    // actionable version first (the generic `graphql()` guard would say
    // "comment or react", which is not what the admin just tried to do).
    if (!this.ctx.getToken()) {
      throw new GitalkError('Log in with GitHub to initialize this page', 401)
    }

    const target = await this.resolveCreationTarget()

    // `title` is `String!` and an empty one is useless for the title-based
    // lookup, so an unset/blank title falls back to the page id. `body` may be
    // empty; GitHub accepts "".
    const title = this.opts.title?.trim() || this.ctx.term()

    const response = await this.graphqlRequest<CreateDiscussionData>(CREATE_DISCUSSION, {
      repositoryId: target.repositoryId,
      categoryId: target.category.id,
      title,
      body: this.opts.body ?? ''
    })

    if (response.errors?.length) throw this.creationError(response.errors)

    const discussion = response.data?.createDiscussion?.discussion
    if (!discussion) {
      throw new GitalkError(
        `${this.ctx.owner}/${this.ctx.repo}: GitHub reported no error but returned no discussion`
      )
    }

    return {
      kind: 'discussions',
      number: discussion.number,
      title: discussion.title,
      url: discussion.url,
      nodeId: discussion.id,
      locked: discussion.locked ?? false
    }
  }

  /**
   * Resolve the repository id and the category to post into, or throw an error
   * that says which of the three operator-fixable situations this is.
   *
   * Category selection: `CreateDiscussionInput.categoryId` is non-nullable, so
   * omitting it is not an option — GitHub offers no "default category" input.
   * When the caller configured no `category`, the first category the API lists
   * is used (GitHub lists a repository's categories in a stable order); when
   * one is configured it is matched case-insensitively against both `slug` and
   * `name`, matching the documented "slug or name" contract of the option.
   */
  private async resolveCreationTarget(): Promise<{
    repositoryId: string
    category: DiscussionCategoryNode
  }> {
    const response = await this.graphqlRequest<CreationTargetData>(RESOLVE_CREATION_TARGET, {
      owner: this.ctx.owner,
      name: this.ctx.repo
    })

    // A token without read access to the repository fails here, not at the
    // mutation, so it has to go through the same classifier or the operator
    // would only see GitHub's `Resource not accessible by integration`.
    if (response.errors?.length) throw this.creationError(response.errors)

    const where = `${this.ctx.owner}/${this.ctx.repo}`
    const repository = response.data?.repository
    if (!repository) {
      throw new GitalkError(
        `GitHub could not resolve ${where}: check the \`owner\`/\`repo\` options, and that the ` +
          'signed-in account can see the repository (a private repository the account cannot ' +
          'read looks exactly like a missing one).'
      )
    }

    if (!repository.hasDiscussionsEnabled) {
      throw new GitalkError(
        `Discussions are disabled for ${where}. Turn them on under Settings -> General -> ` +
          'Features -> Discussions, then create a category and retry.'
      )
    }

    const categories = repository.discussionCategories?.nodes ?? []
    if (!categories.length) {
      throw new GitalkError(
        `${where} has Discussions enabled but no categories to post into. Create one under the ` +
          'Discussions tab, then retry.'
      )
    }

    const wanted = this.opts.category?.trim()
    if (!wanted) {
      // No guesswork: this is simply the first category GitHub returns. Set
      // `category` explicitly to pin a different one.
      return { repositoryId: repository.id, category: categories[0]! }
    }

    const needle = wanted.toLowerCase()
    const match = categories.find(
      (c) => c.slug.toLowerCase() === needle || c.name.toLowerCase() === needle
    )
    if (!match) {
      const available = categories.map((c) => `${c.name} (\`${c.slug}\`)`).join(', ')
      throw new GitalkError(
        `No discussion category matching \`${wanted}\` exists in ${where}. Available: ${available}`
      )
    }

    return { repositoryId: repository.id, category: match }
  }

  /**
   * Turn a failed `createDiscussion` into an actionable message.
   *
   * The three cases have different fixes, so they must not collapse into one
   * string: the account/app lacks write permission; Discussions were turned
   * off for the repository; or the resolved category was rejected. Anything
   * else keeps GitHub's own wording rather than guessing.
   */
  private creationError(errors: GraphQLError[]): GitalkError {
    const message = errors.map((e) => e.message).join(', ')
    const types = new Set(errors.map((e) => e.type).filter((t): t is string => Boolean(t)))
    const where = `${this.ctx.owner}/${this.ctx.repo}`

    if (
      types.has('FORBIDDEN') ||
      types.has('INSUFFICIENT_SCOPES') ||
      /not accessible|forbidden|permission|resource not accessible/i.test(message)
    ) {
      return new GitalkError(
        `GitHub refused to create a discussion in ${where}: ${message}. The signed-in account ` +
          'needs write access to the repository, and the OAuth app / GitHub App needs the ' +
          '`discussions: write` permission (classic OAuth apps: the `repo` or `public_repo` scope).',
        403
      )
    }

    if (/discussions?\s+(are|is)\s+(disabled|not enabled)|discussions? disabled/i.test(message)) {
      return new GitalkError(
        `Discussions are disabled for ${where}: ${message}. Turn them on under Settings -> ` +
          'General -> Features -> Discussions, then retry.'
      )
    }

    if (/categor/i.test(message)) {
      return new GitalkError(
        `GitHub rejected the discussion category in ${where}: ${message}. Set the \`category\` ` +
          'option to one of the repository\'s existing category slugs.'
      )
    }

    return new GitalkError(`Could not create a discussion in ${where}: ${message}`, 422)
  }

  /**
   * Load comments over REST.
   *
   * REST is the only anonymous-capable read path (60 req/hr per IP), so this
   * is deliberately chosen over GraphQL for display. Four wrinkles are
   * handled here, all verified against the live API:
   *
   *  1. REST returns replies *interleaved* with top-level comments, whereas
   *     GraphQL nests them under `replies`. We regroup by `parent_id` so the
   *     UI sees one shape regardless of transport.
   *  2. REST omits viewer reaction state for anonymous callers (there is no
   *     viewer), so `viewerReactions` stays empty until the user interacts.
   *  3. REST pagination is offset-based (`page` + `per_page`) with no cursor,
   *     so `page` is threaded through `PageOptions`.
   *  4. **REST ignores `direction`.** Measured on api.github.com:
   *     `/discussions/442/comments` returns the identical ascending payload
   *     for `direction=asc`, `direction=desc`, and no parameter at all. The
   *     order is therefore derived here ({@link sortComments}) and the
   *     newest-first window is read from the *end* of the feed
   *     ({@link BaseBackend.readCommentPage}).
   *
   * REST does expose `node_id`, and it equals the GraphQL node id, so the ids
   * needed for later mutations are available even anonymously.
   */
  async getComments({ first, direction, page, fresh }: PageOptions): Promise<ThreadPage> {
    const thread = this.ctx.getThread()
    if (!thread) throw new GitalkError('Thread has not been resolved yet')

    const perPage = Math.min(Math.max(first, 1), MAX_PER_PAGE)
    const currentPage = Math.max(page ?? 1, 1)
    const order = direction === 'first' ? 'first' : 'last'

    const { items: raw, hasNextPage, hasPreviousPage } = await this.readCommentPage<RawComment>({
      path: `/repos/${this.ctx.owner}/${this.ctx.repo}/discussions/${thread.number}/comments`,
      perPage,
      direction: order,
      page: currentPage,
      fresh,
      totalCount: thread.commentCount
    })

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

    // Sorting after regrouping keeps each parent's replies attached, and
    // reversing the batch is not enough on its own: an out-of-order or
    // interleaved payload would still come out wrong.
    const comments = sortComments(topLevel, order)
    const head = comments[0]

    return {
      comments,
      totalCount: thread.commentCount ?? comments.length,
      hasNextPage,
      hasPreviousPage,
      endCursor: head ? String(head.id) : null,
      startCursor: head ? String(head.id) : null,
      page: currentPage
    }
  }

  async addComment(body: string, replyTo?: number): Promise<GitalkComment | GitalkReply> {
    const thread = this.ctx.getThread()
    if (!thread?.nodeId) throw new GitalkError('Discussion node id is required to comment')

    // Reply ids resolve through the map filled during reads. Failing loudly
    // beats the alternative the old code took: passing `null` and quietly
    // posting the reply as a brand-new top-level comment.
    let replyToId: string | null = null
    if (replyTo != null) {
      replyToId = this.nodeIdFor(replyTo)
      if (!replyToId) {
        throw new GitalkError(
          'Cannot reply: the comment being replied to is not part of the loaded page'
        )
      }
    }

    const payload = await this.graphql<{ addDiscussionComment: { comment: GraphQLComment } }>(
      ADD_COMMENT,
      {
        body,
        discussionId: thread.nodeId,
        replyToId
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
   * Upvote state of the discussion itself.
   *
   * `upvoteCount` / `viewerHasUpvoted` are GraphQL-only fields, and GraphQL
   * refuses anonymous callers, so an anonymous visitor gets `null` rather than
   * a failed request. The UI renders the control without a count in that case
   * and asks the visitor to sign in when they use it.
   */
  override async getUpvote(): Promise<UpvoteState | null> {    const thread = this.ctx.getThread()
    if (!thread?.nodeId || !this.ctx.getToken()) return null

    const data = await this.graphql<{
      node: { upvoteCount?: number; viewerHasUpvoted?: boolean } | null
    }>(DISCUSSION_UPVOTE, { id: thread.nodeId })

    if (!data.node) return null
    return {
      count: data.node.upvoteCount ?? 0,
      viewerHasUpvoted: Boolean(data.node.viewerHasUpvoted)
    }
  }

  /** Add or remove the viewer's upvote on the discussion. */
  override async setUpvote(on: boolean): Promise<void> {
    const thread = this.ctx.getThread()
    if (!thread?.nodeId) throw new GitalkError('Cannot upvote: the discussion has no GraphQL node id')
    await this.graphql(on ? ADD_UPVOTE : REMOVE_UPVOTE, { subjectId: thread.nodeId })
  }

  /**
   * Ask GraphQL whether the signed-in viewer reacted with each comment.
   *
   * The REST read cannot answer this, so without it the picker would forget
   * the viewer's own reactions on every reload. One request covers a whole
   * page; anonymous viewers get an empty map (their viewer state is
   * unknowable, and GraphQL would refuse the request anyway).
   */
  override async getReactionStates(nodeIds: string[]): Promise<Map<string, ReactionState>> {
    return fetchReactionStates(this.ctx, nodeIds, (query, variables) =>
      this.graphql<{ nodes?: ReactionStateNode[] | null }>(query, variables)
    )
  }

  /**
   * Resolve a REST numeric id to its GraphQL node id.
   *
   * Needed because `replyToId` takes a node id while the UI only knows the
   * numeric id. The map is filled by every read and by every comment this
   * widget creates, so replying to a comment on screen resolves without an
   * extra request.
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
      // REST reports every type under its own key (`+1`, `-1`, `laugh`, ...),
      // which is what lets the picker show real counts without GraphQL.
      reactions: reactionsFromRest(item.reactions),
      isAuthor: false
    }
  }

  /**
   * Turn a freshly created comment's `reactionGroups` into the shared shape.
   *
   * GraphQL is the only transport that answers "did *this viewer* react?", so
   * this is where `viewerReactions` gets its first real value; later toggles
   * are merged in locally by the widget.
   */
  private fromGraphQL(node: GraphQLComment): GitalkReply {
    // Remember the id pair so a reply to this brand-new comment resolves too.
    this.replyNodeIds.set(
      `${this.ctx.getThread()?.number ?? 0}:${node.databaseId}`,
      node.id
    )

    const { counts, viewerReactions } = reactionsFromGroups(node.reactionGroups)
    const totalCount = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0)

    return {
      id: node.databaseId,
      nodeId: node.id,
      user: this.normalizeGraphqlUser(node.author),
      bodyHtml: node.bodyHTML ?? '',
      createdAt: node.createdAt,
      htmlUrl: node.url,
      reactions: {
        totalCount,
        viewerHasReacted: Object.keys(viewerReactions).length > 0,
        counts,
        viewerReactions
      },
      isAuthor: true
    }
  }

  /**
   * GraphQL round trip that fails only on transport problems.
   *
   * The anonymous guard lives here rather than in `graphql()` because every
   * caller needs it: GraphQL's anonymous allowance is literally zero
   * (`x-ratelimit-limit: 0`), so sending the request anyway would trade an
   * actionable message for a confusing 403.
   */
  private async graphqlRequest<T>(
    query: string,
    variables: Record<string, unknown>
  ): Promise<{ data?: T; errors?: GraphQLError[] }> {
    if (!this.ctx.getToken()) {
      throw new GitalkError('Log in with GitHub to comment or react', 401)
    }

    return this.ctx.graphql<{ data?: T; errors?: GraphQLError[] }>({ query, variables })
  }

  private async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await this.graphqlRequest<T>(query, variables)

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
