export interface GitHubUser {
  login: string
  avatar_url: string
  html_url: string
}

export interface GitHubIssue {
  number: number
  title: string
  body: string
  html_url: string
  comments: number
  comments_url: string
  labels: Array<{ name: string }>
}

export interface ReactionNode {
  id: string | number
  databaseId?: number
  user: { login: string }
  content?: string
}

export interface CommentReactions {
  totalCount: number
  viewerHasReacted: boolean
  pageInfo?: { hasNextPage: boolean }
  nodes: ReactionNode[]
}

/** 统一的评论模型：REST v3（full+json）与 GraphQL v4 都映射到这个结构 */
export interface GitalkComment {
  id: number
  /** GraphQL node id，仅登录后（v4 拉取）存在，用于取消点赞 mutation */
  gId?: string
  user: GitHubUser | null
  created_at: string
  body_html: string
  body?: string
  html_url: string
  reactions?: CommentReactions
}

export interface DefaultAuthor {
  avatarUrl: string
  login: string
  url: string
}
