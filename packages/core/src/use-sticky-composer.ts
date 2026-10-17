import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

/** The subset of `DOMRect` the dock maths needs. */
export interface DockRect {
  top: number
  bottom: number
  left: number
  width: number
  height: number
}

export interface DockGeometry {
  left: number
  width: number
}

/** Horizontal breathing room between the widget and the docked composer. */
const GAP = 12

/** Narrowest composer worth docking; below this it would be unusable. */
const MIN_WIDTH = 220

/** Hysteresis: once docked, stay docked until the widget clears the edge. */
const HYSTERESIS = 8

/**
 * Decide whether the composer should leave the document flow.
 *
 * The composer docks once the widget's bottom edge reaches (or passes) the
 * bottom of the visible viewport, and only while the widget is at least
 * partly on screen. The `docked` argument adds a few pixels of hysteresis so a
 * one-pixel scroll jitter cannot flip between states.
 *
 * Pure so the boundary cases are testable without a layout engine.
 */
export function shouldDock(
  rect: Pick<DockRect, 'top' | 'bottom'>,
  viewportBottom: number,
  docked: boolean,
  hysteresis = HYSTERESIS
): boolean {
  if (!Number.isFinite(rect.top) || !Number.isFinite(rect.bottom)) return false
  if (!Number.isFinite(viewportBottom) || viewportBottom <= 0) return false

  const visible = rect.bottom > 0 && rect.top < viewportBottom
  const threshold = docked ? viewportBottom - hysteresis : viewportBottom
  return visible && rect.bottom >= threshold
}

/**
 * Align the fixed composer with the widget's column.
 *
 * The composer is `position: fixed`, so it cannot inherit the container's
 * width; this reproduces the reference's `positionFixedDock()`: inset by the
 * same 12px gutter, never narrower than {@link MIN_WIDTH}, and clamped to the
 * visual viewport (important when the on-screen keyboard shrinks it).
 */
export function dockGeometry(
  rect: Pick<DockRect, 'left' | 'width'>,
  viewportWidth: number,
  gap = GAP
): DockGeometry {
  const safeViewport = Math.max(0, viewportWidth)
  const maxWidth = Math.max(0, safeViewport - gap * 2)
  let left = Math.max(gap, rect.left + gap)
  let width = Math.max(0, rect.width - gap * 2)

  if (width < MIN_WIDTH) {
    width = Math.min(MIN_WIDTH, maxWidth)
    left = Math.min(Math.max(gap, rect.left), Math.max(gap, safeViewport - gap - width))
  }
  if (width > maxWidth) width = maxWidth
  if (left + width > safeViewport - gap) {
    left = Math.max(gap, safeViewport - gap - width)
  }

  return { left: Math.round(left), width: Math.round(width) }
}

interface ElementRef<T extends HTMLElement> {
  current: T | null
}

interface StickyComposerOptions {
  /** False while collapsed or when the host disabled `stickyComposer`. */
  enabled: boolean
  containerRef: ElementRef<HTMLElement>
  composerRef: ElementRef<HTMLElement>
}

interface StickyComposerState {
  docked: boolean
  /**
   * Height of the composer at the moment it docked, used to reserve its place
   * in the flow. Measured before the class flips, while it still has layout.
   */
  placeholderHeight: number
}

function clearDockStyles(el: HTMLElement | null): void {
  if (!el) return
  el.style.left = ''
  el.style.width = ''
  el.style.removeProperty('--gt-kb')
}

/**
 * Keep the composer docked to the bottom of the viewport while the widget's
 * bottom edge is at (or past) the fold.
 *
 * Listens to page scroll, window resize and the visual viewport (the on-screen
 * keyboard on mobile), throttled with `requestAnimationFrame`. A
 * `ResizeObserver` covers host layout changes that do not fire either event
 * (a sidebar opening, for example).
 */
export function useStickyComposer({
  enabled,
  containerRef,
  composerRef
}: StickyComposerOptions): StickyComposerState {
  const [docked, setDocked] = useState(false)
  const [placeholderHeight, setPlaceholderHeight] = useState(0)
  const dockedRef = useRef(false)

  const update = useCallback(() => {
    const container = containerRef.current
    const composer = composerRef.current

    if (!enabled) {
      if (dockedRef.current) {
        dockedRef.current = false
        setDocked(false)
      }
      clearDockStyles(composer)
      return
    }
    if (!container) return

    const rect = container.getBoundingClientRect()
    // Not laid out yet (jsdom, or a container still `display:none`): nothing
    // sensible to compare, and docking a zero-height box would be wrong.
    if (rect.height <= 0) {
      if (dockedRef.current) {
        dockedRef.current = false
        setDocked(false)
        clearDockStyles(composer)
      }
      return
    }

    const viewport = window.visualViewport
    // A visual viewport with zero height means the page is hidden (or the
    // browser has not measured it yet); fall back to the layout viewport
    // rather than treating the widget as permanently docked.
    const viewportBottom =
      viewport && viewport.height > 0 ? viewport.offsetTop + viewport.height : window.innerHeight
    const viewportWidth =
      viewport && viewport.width > 0 ? viewport.width : window.innerWidth
    const next = shouldDock(rect, viewportBottom, dockedRef.current)

    if (next) {
      const height = composer?.getBoundingClientRect().height ?? 0
      // Nothing to reserve means the composer has no layout yet. Docking now
      // would shorten the container by zero pixels and could oscillate; wait
      // for the next scroll/resize instead.
      if (height <= 0) {
        if (dockedRef.current) {
          dockedRef.current = false
          setDocked(false)
          clearDockStyles(composer)
        }
        return
      }
      // Keep the spacer in step with the composer even after it docks (a
      // visitor can resize the textarea), so the widget's height never drifts.
      const rounded = Math.max(0, Math.round(height))
      setPlaceholderHeight((previous) => (previous === rounded ? previous : rounded))
    }
    if (next !== dockedRef.current) {
      dockedRef.current = next
      setDocked(next)
    }

    if (!composer) return
    if (next) {
      const { left, width } = dockGeometry(rect, viewportWidth)
      const leftCss = `${left}px`
      const widthCss = `${width}px`
      if (composer.style.left !== leftCss) composer.style.left = leftCss
      if (composer.style.width !== widthCss) composer.style.width = widthCss
      // The on-screen keyboard overlays the layout viewport on mobile, so the
      // CSS `bottom` needs the visual-viewport gap as well as the safe area.
      const keyboard = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0
      const keyboardCss = `${Math.round(keyboard)}px`
      if (composer.style.getPropertyValue('--gt-kb') !== keyboardCss) {
        composer.style.setProperty('--gt-kb', keyboardCss)
      }
    } else {
      clearDockStyles(composer)
    }
  }, [composerRef, containerRef, enabled])

  useEffect(() => {
    let frame: number | null = null

    const raf =
      typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 16)
    const cancel = (id: number) => {
      if (typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(id)
      window.clearTimeout(id)
    }
    const schedule = () => {
      if (frame != null) return
      frame = raf(() => {
        frame = null
        update()
      })
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)
    window.visualViewport?.addEventListener('resize', schedule)

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule)
      if (containerRef.current) observer.observe(containerRef.current)
      if (composerRef.current) observer.observe(composerRef.current)
    }

    return () => {
      if (frame != null) cancel(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      observer?.disconnect()
    }
  }, [composerRef, containerRef, update])

  return { docked, placeholderHeight }
}
