import type { DefaultAuthor } from './core/github/types'
import type { PagerDirection } from './core/github/graphql'

export interface GitalkOptions {
  /** GitHub OAuth Application Client ID */
  clientID: string
  /** GitHub OAuth Application Client Secret */
  clientSecret: string
  /** GitHub 仓库名 */
  repo: string
  /** 仓库 owner（个人或组织） */
  owner: string
  /** 有 issue 写权限的管理员（自动/手动初始化 issue 用） */
  admin: string | string[]
  /** 页面唯一标识（issue label），默认 location.href，长度须 <= 50 */
  id?: string
  /** 指定 issue number（优先于 id 匹配），默认 -1 */
  number?: number
  /** issue 标签 */
  labels?: string[]
  /** issue 标题，默认 document.title */
  title?: string
  /** issue 内容，默认 url + meta description */
  body?: string
  /** 界面语言，默认 navigator.language */
  language?: string
  /** 每页评论数，最大 100 */
  perPage?: number
  /** 排序方向：last 最新在前 / first 最早在前 */
  pagerDirection?: PagerDirection
  /** 未找到 issue 时是否需要管理员手动初始化 */
  createIssueManually?: boolean
  /** 快捷键 cmd/ctrl + enter 提交 */
  enableHotKey?: boolean
  /** 评论输入聚焦时的无干扰模式 */
  distractionFreeMode?: boolean
  /** OAuth code 换 token 的代理地址 */
  proxy?: string
  /**
   * @deprecated v1 的 react-flip-move 已移除，动画改为纯 CSS。
   * 保留该字段仅为兼容 v1 配置，传任意值均不再生效。
   */
  flipMoveOptions?: Record<string, unknown>
  /** 页面 url，默认 location.href */
  url?: string
  /** 评论作者被删除时的兜底展示 */
  defaultAuthor?: DefaultAuthor
  /** 评论数更新回调 */
  updateCountCallback?: ((count: number) => void) | null
  /** 挂载容器（元素或元素 id），也可在 render() 时传入 */
  container?: string | HTMLElement
}

export type ResolvedGitalkOptions = GitalkOptions &
  Required<
    Pick<
      GitalkOptions,
      | 'id'
      | 'number'
      | 'labels'
      | 'title'
      | 'body'
      | 'language'
      | 'perPage'
      | 'pagerDirection'
      | 'createIssueManually'
      | 'enableHotKey'
      | 'distractionFreeMode'
      | 'proxy'
      | 'url'
      | 'defaultAuthor'
    >
  >

export const DEFAULT_PROXY =
  'https://cors-anywhere.azm.workers.dev/https://github.com/login/oauth/access_token'

export function resolveOptions(options: GitalkOptions): ResolvedGitalkOptions {
  return {
    id: window.location.href,
    number: -1,
    labels: ['Gitalk'],
    title: window.document.title,
    body: '',
    language: window.navigator.language,
    perPage: 10,
    pagerDirection: 'last',
    createIssueManually: false,
    enableHotKey: true,
    distractionFreeMode: false,
    proxy: DEFAULT_PROXY,
    url: window.location.href,
    defaultAuthor: {
      avatarUrl: '//avatars1.githubusercontent.com/u/29697133?s=50',
      login: 'null',
      url: '',
    },
    updateCountCallback: null,
    ...options,
  }
}
