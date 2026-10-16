import { render } from 'preact'
import { GitalkWidget } from './widget'
import type { GitalkOptions } from './types'

export interface MountResult {
  update(next: Partial<GitalkOptions>): void
  unmount(): void
}

/**
 * Mount the widget into a DOM node. Shared by the standalone (`window.Gitalk`)
 * entry and the React/Vue wrappers, so all three behave identically.
 */
export function mount(container: Element, options: GitalkOptions): MountResult {
  let current = options

  const draw = () => render(<GitalkWidget options={current} />, container)

  draw()

  return {
    update(next) {
      current = { ...current, ...next }
      draw()
    },
    unmount() {
      render(null, container)
    }
  }
}
