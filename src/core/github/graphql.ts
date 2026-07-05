import { githubRequest } from './rest'
import { GitApiError } from './error'
import type { CommentReactions, DefaultAuthor, GitalkComment } from './types'

export type PagerDirection = 'last' | 'first'

interface GraphQLCommentNode {
  id: string
  databaseId: number
  author: { avatarUrl: string; login: string; url: string } | null
  bodyHTML: string
  body: string
  createdAt: string
  reactions: CommentReactions
}

interface GraphQLCommentsData {
  totalCount: number
  pageInfo: {
    hasPreviousPage?: boolean
    hasNextPage?: boolean
    startCursor?: string
    endCursor?: string
  }
  nodes: GraphQLCommentNode[]
}

const buildQuery = (pagerDirection: PagerDirection) => {
  const cursorDirection = pagerDirection === 'last' ? 'before' : 'after'
  return `
  query getIssueAndComments(
    $owner: String!,
    $repo: String!,
    $id: Int!,
    $cursor: String,
    $pageSize: Int!
  ) {
    repository(owner: $owner, name: $repo) {
      issue(number: $id) {
        title
        url
        bodyHTML
        createdAt
        comments(${pagerDirection}: $pageSize, ${cursorDirection}: $cursor) {
          totalCount
          pageInfo {
            ${pagerDirection === 'last' ? 'hasPreviousPage' : 'hasNextPage'}
            ${cursorDirection === 'before' ? 'startCursor' : 'endCursor'}
          }
          nodes {
            id
            databaseId
            author {
              avatarUrl
              login
              url
            }
            bodyHTML
            body
            createdAt
            reactions(first: 100, content: HEART) {
              totalCount
              viewerHasReacted
              pageInfo{
                hasNextPage
              }
              nodes {
                id
                databaseId
                user {
                  login
                }
              }
            }
          }
        }
      }
    }
  }
  `
}

async function graphql<T>(payload: object, token: string): Promise<T> {
  const res = await githubRequest<{ data?: T; errors?: Array<{ message: string }> }>('/graphql', {
    method: 'POST',
    body: payload,
    headers: { Authorization: `bearer ${token}` },
  })
  if (!res.data) {
    throw new GitApiError(200, {
      message: 'GraphQL request failed',
      errors: res.errors,
    })
  }
  return res.data
}

export interface CommentsPage {
  items: GitalkComment[]
  isLoadOver: boolean
  cursor: string | null
  totalCount: number
}

/** 登录后经 GraphQL v4 分页拉取评论（支持排序方向），登出状态走 REST v3 */
export async function getCommentsPage(opts: {
  owner: string
  repo: string
  issueNumber: number
  perPage: number
  pagerDirection: PagerDirection
  cursor: string | null
  token: string
  defaultAuthor: DefaultAuthor
}): Promise<CommentsPage> {
  const { owner, repo, issueNumber, perPage, pagerDirection, cursor, token, defaultAuthor } = opts

  const variables: Record<string, unknown> = {
    owner,
    repo,
    id: issueNumber,
    pageSize: perPage,
  }
  if (cursor !== null) variables.cursor = cursor

  const data = await graphql<{
    repository: { issue: { comments: GraphQLCommentsData } }
  }>(
    {
      operationName: 'getIssueAndComments',
      query: buildQuery(pagerDirection),
      variables,
    },
    token
  )

  const comments = data.repository.issue.comments
  const items = comments.nodes.map((node) => {
    const author = node.author || defaultAuthor
    return {
      id: node.databaseId,
      gId: node.id,
      user: {
        avatar_url: author.avatarUrl,
        login: author.login,
        html_url: author.url,
      },
      created_at: node.createdAt,
      body_html: node.bodyHTML,
      body: node.body,
      html_url: `https://github.com/${owner}/${repo}/issues/${issueNumber}#issuecomment-${node.databaseId}`,
      reactions: node.reactions,
    } satisfies GitalkComment
  })

  return {
    items,
    isLoadOver:
      comments.pageInfo.hasPreviousPage === false || comments.pageInfo.hasNextPage === false,
    cursor: comments.pageInfo.startCursor || comments.pageInfo.endCursor || null,
    totalCount: comments.totalCount,
  }
}

/** 取消点赞（REST 无对应能力，沿用 v4 removeReaction mutation） */
export async function removeCommentReaction(gId: string, token: string): Promise<void> {
  await graphql(
    {
      operationName: 'RemoveReaction',
      query: `
          mutation RemoveReaction{
            removeReaction (input:{
              subjectId: "${gId}",
              content: HEART
            }) {
              reaction {
                content
              }
            }
          }
        `,
    },
    token
  )
}
