import type { GitalkOptions } from '@aifire/gitalk'

/**
 * Same discussion as the landing-page demo (#607 in gitalk/gitalk), so a user
 * can post here and see the comment on the landing page too.
 *
 * `owner` and `repo` are separate fields in 2.x; `repo` is the repository
 * name only, not the `owner/repo` pair.
 */
export const options: GitalkOptions = {
  clientID: 'Iv23liM54pLB6TIqnqb6',
  owner: 'gitalk',
  repo: 'gitalk',
  admin: ['booxood'],
  number: 607,
  proxy: 'https://gitalk-proxy.aispin-abf.workers.dev',
  language: 'zh-CN'
}
