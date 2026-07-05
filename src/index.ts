import { h, render } from 'preact'
import GitalkComponent from './components/Gitalk'
import type { GitalkOptions } from './options'

import 'github-markdown-css/github-markdown-light.css'
import './styles/gitalk.css'

/**
 * 对外 API 与 v1 完全兼容：
 *   const gitalk = new Gitalk({ clientID, clientSecret, repo, owner, admin })
 *   gitalk.render('gitalk-container')
 */
class Gitalk {
  readonly options: GitalkOptions
  private container: HTMLElement | null = null

  constructor(options: GitalkOptions) {
    this.options = options
  }

  render(container?: string | HTMLElement, callback?: () => void): this {
    const target = container || this.options.container
    if (!target) throw new Error(`Container is required: ${target}`)

    let node: HTMLElement | null
    if (target instanceof HTMLElement) {
      node = target
    } else {
      node = window.document.getElementById(target)
      if (!node) throw new Error(`Container not found, window.document.getElementById: ${target}`)
    }

    this.container = node
    render(h(GitalkComponent, { options: this.options }), node)
    callback?.()
    return this
  }

  /** 卸载组件并清空容器（v2 新增） */
  destroy(): void {
    if (this.container) {
      render(null, this.container)
      this.container = null
    }
  }
}

export default Gitalk
export type { GitalkOptions, ResolvedGitalkOptions } from './options'
export type { GitalkComment, GitHubIssue, GitHubUser } from './core/github/types'
