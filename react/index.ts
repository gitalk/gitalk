import { createElement, useEffect, useRef, type ReactElement } from 'react'
import Gitalk from '../src/index'
import type { GitalkOptions } from '../src/options'

export interface GitalkComponentProps {
  options: GitalkOptions
  /** 外层容器 className，默认 gitalk-container */
  className?: string
}

/**
 * React 出口（替代 v1 的 dist/gitalk-component.js）：
 *   import GitalkComponent from 'gitalk/react'
 *   import 'gitalk/dist/gitalk.css'
 *   <GitalkComponent options={{ clientID, clientSecret, repo, owner, admin }} />
 *
 * 内部挂载 Preact 渲染的核心组件，对宿主而言是一个普通 React 组件。
 */
export default function GitalkComponent({
  options,
  className = 'gitalk-container',
}: GitalkComponentProps): ReactElement {
  const container = useRef<HTMLDivElement>(null)
  const instance = useRef<Gitalk | null>(null)

  useEffect(() => {
    if (!container.current) return
    instance.current = new Gitalk(options).render(container.current)
    return () => {
      instance.current?.destroy()
      instance.current = null
    }
    // 与 v1 一致：options 仅在首次挂载时生效
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return createElement('div', { className, ref: container })
}

export type { GitalkOptions }
