import { mount, type MountResult } from './mount'
import type { GitalkOptions } from './types'

/**
 * Framework-free entry: the class behind `new Gitalk({...}).render('#el')`.
 * Exposed as `window.Gitalk` by dist/gitalk.js.
 */
export default class Gitalk {
  private instance: MountResult | null = null

  constructor(private readonly options: GitalkOptions) {}

  render(container?: string | Element): void {
    const node = resolve(container ?? this.options.id)
    if (!node) throw new Error(`Gitalk: container not found: ${String(container)}`)
    this.instance = mount(node, this.options)
  }

  update(options: Partial<GitalkOptions>): void {
    this.instance?.update(options)
  }

  destroy(): void {
    this.instance?.unmount()
    this.instance = null
  }
}

function resolve(target?: string | Element): Element | null {
  if (typeof target !== 'string') return target ?? document.getElementById('gitalk-container')
  return target.startsWith('#')
    ? document.querySelector(target)
    : document.getElementById(target)
}

// The `window.Gitalk` assignment lives in `global-entry.ts`, which is built as
// the IIFE bundle only. Keeping it out of here means importing this module as
// ESM (via @gitalk/core) never has the side effect of clobbering a page global.
