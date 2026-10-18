/**
 * GraphQL documents the widget may send for **anonymous reads**.
 *
 * These are the only documents the token endpoint will execute with the GitHub
 * App installation token when a request carries no visitor token. The proxy
 * keeps its own copy (see `packages/proxy-core/src/index.ts`) and substitutes
 * that trusted copy for whatever the caller sent, so this module is the client
 * half of one contract:
 *
 *  - every document is a single `query` (never a mutation or subscription);
 *  - it is scoped by `$owner` / `$repo` variables, which the proxy checks
 *    against GitHub's public-visibility endpoint before using its token;
 *  - it asks for public repository data only — no `viewer`, no `node(id:)`,
 *    no `search` across repositories.
 *
 * The query text does not have to match the proxy's copy byte for byte: the
 * proxy uses the operation name to pick its own canonical document. Keep the
 * **meaning** and the variable names in step, though — drift makes the widget
 * fall back to REST (correct, but 60/hr instead of 5,000/hr).
 */

/**
 * One discussion by number. Used for the recommended `number:` configuration.
 *
 * `comments` is deliberately not requested here: the widget does not use the
 * thread's count to page GraphQL results (unlike REST, which needs it to find
 * the last offset page), and leaving it out keeps `ThreadInfo.commentCount`
 * undefined so a later REST fallback re-probes its own pagination instead of
 * trusting a GraphQL count that excludes replies.
 */
export const DISCUSSION_THREAD_QUERY = `
query gitalkDiscussion($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    discussion(number: $number) {
      id
      number
      title
      url
      locked
    }
  }
}`

/**
 * Title lookup fallback for Discussions.
 *
 * GitHub's REST `search/issues` does not index Discussions, and GraphQL's
 * cross-repository `search` cannot be scoped safely for an anonymous caller
 * (the proxy only validates `$owner`/`$repo`). Walking the repository's own
 * discussion list is the equivalent it can safely allow.
 */
export const DISCUSSION_LIST_QUERY = `
query gitalkDiscussionList($owner: String!, $repo: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    discussions(first: $first, after: $after, orderBy: {field: CREATED_AT, direction: DESC}) {
      nodes {
        id
        number
        title
        url
        locked
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}`

/**
 * One page of discussion comments.
 *
 * Cursor pagination is translated from the widget's logical page numbers by
 * the backend. `replies` keeps the one-level tree the UI renders, and
 * `reactionGroups` replaces the separate viewer-state query: an anonymous
 * viewer has no flags, but the per-type counts are what the picker shows.
 *
 * `... on User { name }` is the only transport that yields an author's profile
 * display name: REST's comment payload has just `user.login`, and one
 * `/users/{login}` request per comment would spend the anonymous 60/hr
 * allowance. The field is nullable, so the renderer falls back to the login.
 * The proxy's canonical copy must carry the same selection.
 */
export const DISCUSSION_COMMENTS_QUERY = `
query gitalkDiscussionComments($owner: String!, $repo: String!, $number: Int!, $first: Int, $last: Int, $after: String, $before: String) {
  repository(owner: $owner, name: $repo) {
    discussion(number: $number) {
      comments(first: $first, last: $last, after: $after, before: $before) {
        totalCount
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        nodes {
          id
          databaseId
          author { login avatarUrl url ... on User { name } }
          createdAt
          url
          bodyHTML
          reactionGroups { content viewerHasReacted reactors(first: 0) { totalCount } }
          replies(first: 100) {
            totalCount
            nodes {
              id
              databaseId
              author { login avatarUrl url ... on User { name } }
              createdAt
              url
              bodyHTML
              reactionGroups { content viewerHasReacted reactors(first: 0) { totalCount } }
            }
          }
        }
      }
    }
  }
}`

/** One issue by number. */
export const ISSUE_THREAD_QUERY = `
query gitalkIssue($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      id
      number
      title
      url
      locked
    }
  }
}`

/**
 * Issues are looked up by label (the v1 storage model). `states` includes both
 * open and closed issues, matching the REST call's `state=all`.
 */
export const ISSUE_BY_LABEL_QUERY = `
query gitalkIssueByLabel($owner: String!, $repo: String!, $labels: [String!]!) {
  repository(owner: $owner, name: $repo) {
    issues(first: 1, labels: $labels, states: [OPEN, CLOSED]) {
      nodes {
        id
        number
        title
        url
        locked
      }
    }
  }
}`

/** One page of issue comments. Issues have no replies. */
export const ISSUE_COMMENTS_QUERY = `
query gitalkIssueComments($owner: String!, $repo: String!, $number: Int!, $first: Int, $last: Int, $after: String, $before: String) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      comments(first: $first, last: $last, after: $after, before: $before) {
        totalCount
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        nodes {
          id
          databaseId
          author { login avatarUrl url ... on User { name } }
          createdAt
          url
          bodyHTML
          reactionGroups { content viewerHasReacted reactors(first: 0) { totalCount } }
        }
      }
    }
  }
}`

/**
 * Operation-name -> document map. The proxy mirrors the names; a read outside
 * this map is never executed with the installation token.
 */
export const ANONYMOUS_READ_QUERIES = {
  gitalkDiscussion: DISCUSSION_THREAD_QUERY,
  gitalkDiscussionList: DISCUSSION_LIST_QUERY,
  gitalkDiscussionComments: DISCUSSION_COMMENTS_QUERY,
  gitalkIssue: ISSUE_THREAD_QUERY,
  gitalkIssueByLabel: ISSUE_BY_LABEL_QUERY,
  gitalkIssueComments: ISSUE_COMMENTS_QUERY
} as const

export type AnonymousReadOperation = keyof typeof ANONYMOUS_READ_QUERIES
