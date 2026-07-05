import Gitalk from '../src/index'
import type { GitalkOptions } from '../src/options'

declare global {
  interface Window {
    GT_CONFIG?: GitalkOptions
  }
}

// 未提供 dev/config.js 时退化为匿名浏览 gitalk 官方 demo issue 的评论
// （登录需要真实的 GitHub OAuth App clientID/clientSecret）
const fallback: GitalkOptions = {
  clientID: 'not-configured',
  clientSecret: 'not-configured',
  owner: 'gitalk',
  repo: 'gitalk',
  admin: ['booxood'],
  number: 1,
}

new Gitalk(window.GT_CONFIG ?? fallback).render('gitalk-container')
