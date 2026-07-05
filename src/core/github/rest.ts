import { queryStringify } from '../../utils'
import { GitApiError, type GitApiErrorData } from './error'
import type { GitHubIssue, GitHubUser, GitalkComment, ReactionNode } from './types'

const GITHUB_API = 'https://api.github.com'
const ACCEPT_FULL = 'application/vnd.github.v3.full+json'

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  token?: string | null
  params?: Record<string, string | number | undefined>
  body?: unknown
  accept?: string
  headers?: Record<string, string>
  responseType?: 'json' | 'text'
}

export async function githubRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    token,
    params,
    body,
    accept = 'application/json',
    headers: extraHeaders,
    responseType = 'json',
  } = options

  let url = /^https?:/.test(path) ? path : `${GITHUB_API}${path}`
  if (params) url += `${url.includes('?') ? '&' : '?'}${queryStringify(params)}`

  const headers: Record<string, string> = { Accept: accept }
  if (token) headers.Authorization = `token ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  Object.assign(headers, extraHeaders)

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let data: GitApiErrorData | null = null
    try {
      data = await res.json()
    } catch {
      // 非 JSON 错误响应
    }
    throw new GitApiError(res.status, data)
  }

  if (responseType === 'text') return (await res.text()) as T
  return (await res.json()) as T
}

export const getUser = (token: string) => githubRequest<GitHubUser>('/user', { token })

export const getIssueByNumber = (opts: {
  owner: string
  repo: string
  number: number
  token?: string | null
}) =>
  githubRequest<GitHubIssue>(`/repos/${opts.owner}/${opts.repo}/issues/${opts.number}`, {
    token: opts.token,
    params: { t: Date.now() },
  })

export const getIssuesByLabels = (opts: {
  owner: string
  repo: string
  labels: string[]
  token?: string | null
}) =>
  githubRequest<GitHubIssue[]>(`/repos/${opts.owner}/${opts.repo}/issues`, {
    token: opts.token,
    params: { labels: opts.labels.join(','), t: Date.now() },
  })

export const createIssue = (opts: {
  owner: string
  repo: string
  title: string
  labels: string[]
  body: string
  token: string
}) =>
  githubRequest<GitHubIssue>(`/repos/${opts.owner}/${opts.repo}/issues`, {
    method: 'POST',
    body: { title: opts.title, labels: opts.labels, body: opts.body },
    token: opts.token,
  })

export const getIssueComments = (
  commentsUrl: string,
  opts: { page: number; perPage: number; token?: string | null }
) =>
  githubRequest<GitalkComment[]>(commentsUrl, {
    accept: ACCEPT_FULL,
    token: opts.token,
    params: { per_page: opts.perPage, page: opts.page },
  })

export const createIssueComment = (commentsUrl: string, body: string, token: string) =>
  githubRequest<GitalkComment>(commentsUrl, {
    method: 'POST',
    accept: ACCEPT_FULL,
    body: { body },
    token,
  })

export const createCommentReaction = (opts: {
  owner: string
  repo: string
  commentId: number
  token: string
}) =>
  githubRequest<ReactionNode>(
    `/repos/${opts.owner}/${opts.repo}/issues/comments/${opts.commentId}/reactions`,
    {
      method: 'POST',
      accept: 'application/vnd.github+json',
      body: { content: 'heart' },
      token: opts.token,
    }
  )

export const renderMarkdown = (text: string, token?: string | null) =>
  githubRequest<string>('/markdown', {
    method: 'POST',
    body: { text },
    token,
    responseType: 'text',
  })
