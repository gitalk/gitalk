import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from 'preact'
import { useRef } from 'preact/hooks'
import { useStickyComposer } from './use-sticky-composer'

/**
 * Preact runs passive (`useEffect`) cleanups after the next paint, on a timer —
 * not synchronously during `render(null, …)`. When the test environment tears
 * down jsdom in between, the global `window` binding is gone by the time the
 * cleanup runs, and a cleanup that touches it throws a `ReferenceError` from a
 * timer, i.e. as an unhandled error that fails the whole run.
 *
 * This reproduces that window deterministically: unmount, remove the global
 * (vitest's jsdom environment makes `window === globalThis` and deletes both
 * `window` and the listener methods it injected), then let Preact's deferred
 * flush fire.
 */
function Harness() {
  const containerRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  useStickyComposer({ enabled: true, containerRef, composerRef })
  return (
    <div ref={containerRef}>
      <div ref={composerRef} />
    </div>
  )
}

describe('useStickyComposer teardown', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('cleans up after the global window is gone', () => {
    vi.useFakeTimers()
    const host = document.createElement('div')
    document.body.appendChild(host)

    render(<Harness />, host)
    // Let the mount effect run so the listeners are really attached.
    vi.runAllTimers()

    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    const removeDescriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      'removeEventListener'
    )

    // Unmount queues the passive cleanup for Preact's after-paint flush.
    render(null, host)
    // jsdom's teardown closes the window and deletes its globals; simulate the
    // binding disappearing before that flush.
    delete (globalThis as { window?: unknown }).window
    delete (globalThis as { removeEventListener?: unknown }).removeEventListener

    try {
      expect(() => vi.runAllTimers()).not.toThrow()
    } finally {
      if (removeDescriptor) {
        Object.defineProperty(globalThis, 'removeEventListener', removeDescriptor)
      }
      if (windowDescriptor) {
        Object.defineProperty(globalThis, 'window', windowDescriptor)
      }
      host.remove()
    }
  })
})
