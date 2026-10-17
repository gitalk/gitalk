import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from 'react'
import { Logo } from './logo'
import { useI18n } from '../i18n'

/** One hue per sample commenter, in dictionary order. */
const AVATAR_COLORS = [
  '#5eead4',
  '#818cf8',
  '#f472b6',
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#22d3ee',
  '#818cf8'
] as const

const FALLBACK_COLOR = '#818cf8'

/**
 * Static recreation of the comment surface from the design reference.
 *
 * The reference page ships a full interactive widget; here we only reproduce
 * its appearance and the two shell-level behaviours that change layout — the
 * composer docking to the viewport bottom and the minimise/restore toggle that
 * reveals the floating button. Comment interactions, posting, image upload and
 * Markdown preview belong to the core widget, which is mounted separately in
 * the live-demo section.
 */
export function CommentPanel() {
  const { t } = useI18n()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const minRef = useRef<HTMLButtonElement | null>(null)
  const fabRef = useRef<HTMLButtonElement | null>(null)
  const [minimized, setMinimized] = useState(false)
  const [docked, setDocked] = useState(false)
  const [dockBox, setDockBox] = useState<{ left: number; width: number } | null>(null)
  const dockedRef = useRef(false)

  // The composer is attached to the panel while the panel's bottom edge is on
  // screen, and floats above the viewport edge once it would be cut off. This
  // mirrors the reference's scroll handler, including its 6px hysteresis so
  // the bar does not flicker at the threshold.
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap || minimized) return

    let ticking = false

    const positionFixedDock = () => {
      const wr = wrap.getBoundingClientRect()
      const vw = window.innerWidth
      const gap = 12

      let left = wr.left + gap
      let width = wr.width - gap * 2

      if (left < gap) left = gap
      if (left + width > vw - gap) width = vw - gap - left
      if (width < 220) {
        width = Math.max(220, vw - gap * 2)
        left = gap
        if (left + width > vw - gap) width = vw - gap - left
      }

      setDockBox((prev) =>
        prev && prev.left === left && prev.width === width ? prev : { left, width }
      )
    }

    const update = () => {
      ticking = false
      const wr = wrap.getBoundingClientRect()
      const vv = window.visualViewport
      const visTop = vv ? vv.offsetTop : 0
      const visBottom = vv ? vv.offsetTop + vv.height : window.innerHeight

      const visible = wr.bottom > visTop && wr.top < visBottom
      const threshold = dockedRef.current ? visBottom - 6 : visBottom
      const shouldFix = visible && wr.bottom > threshold

      if (shouldFix !== dockedRef.current) {
        dockedRef.current = shouldFix
        setDocked(shouldFix)
      }
      if (shouldFix) positionFixedDock()
    }

    const requestUpdate = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(requestUpdate)
    observer?.observe(wrap)

    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', requestUpdate)
    viewport?.addEventListener('scroll', requestUpdate)

    requestUpdate()

    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      viewport?.removeEventListener('resize', requestUpdate)
      viewport?.removeEventListener('scroll', requestUpdate)
    }
  }, [minimized])

  const minimize = () => {
    dockedRef.current = false
    setDocked(false)
    setMinimized(true)
    // The panel becomes aria-hidden; move focus somewhere still reachable.
    requestAnimationFrame(() => fabRef.current?.focus({ preventScroll: true }))
  }

  const restore = () => {
    setMinimized(false)
    requestAnimationFrame(() => {
      if (window.innerWidth > 1080) inputRef.current?.focus({ preventScroll: true })
      else minRef.current?.focus({ preventScroll: true })
    })
  }

  // 3D tilt + cursor glow, same numbers as the reference: ±4deg, 8deg range.
  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('.c-main')
    if (!target) return
    const rect = target.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    target.style.setProperty('--ry', `${((x - 0.5) * 8).toFixed(2)}deg`)
    target.style.setProperty('--rx', `${((0.5 - y) * 8).toFixed(2)}deg`)
    target.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
    target.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
  }

  const handlePointerOut = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('.c-main')
    if (!target) return
    const related = event.relatedTarget as Node | null
    if (related && target.contains(related)) return
    target.style.setProperty('--ry', '0deg')
    target.style.setProperty('--rx', '0deg')
  }

  const colorFor = (name: string): string => {
    const index = t.panel.comments.findIndex((comment) => comment.name === name)
    return index >= 0 ? AVATAR_COLORS[index] ?? FALLBACK_COLOR : FALLBACK_COLOR
  }

  return (
    <>
      <div
        ref={wrapRef}
        className={`panel-wrap${minimized ? ' is-min' : ''}${docked ? ' is-docked' : ''}`}
        aria-hidden={minimized}
      >
        <section className="panel" aria-label={t.panel.title}>
          <div className="p-head">
            <div className="p-title">
              <h2>{t.panel.title}</h2>
              <span className="p-count">{t.panel.comments.length}</span>
            </div>
            <div className="p-tools">
              <div className="p-sort" role="group" aria-label={t.panel.title}>
                <button className="active" type="button">
                  {t.panel.sortNew}
                </button>
                <button type="button">{t.panel.sortHot}</button>
              </div>
              <button
                ref={minRef}
                className="p-min"
                type="button"
                aria-label={t.panel.minimize}
                title={t.panel.minimize}
                aria-expanded={!minimized}
                onClick={minimize}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-scroll">
            <div
              className="p-list"
              onPointerMove={handlePointerMove}
              onPointerOut={handlePointerOut}
            >
              {t.panel.comments.slice(0, 6).map((comment, index) => (
                <Comment
                  key={comment.name}
                  comment={comment}
                  color={AVATAR_COLORS[index] ?? FALLBACK_COLOR}
                  colorFor={colorFor}
                />
              ))}
            </div>
            <button className="more" type="button">
              {t.panel.loadMore}
            </button>
          </div>
        </section>

        <div
          className={`p-composer${docked ? ' is-fixed' : ''}`}
          style={docked && dockBox ? { left: dockBox.left, width: dockBox.width } : undefined}
        >
          <div className="composer-preview" aria-hidden="true">
            <div className="preview-head">
              <span className="preview-label">{t.panel.previewLabel}</span>
              <span className="preview-hint">{t.panel.previewHint}</span>
              <span className="preview-count" />
            </div>
            <div className="preview-body" />
          </div>

          <div className="me-avatar">{t.panel.me}</div>
          <input
            ref={inputRef}
            type="text"
            maxLength={200}
            placeholder={t.panel.placeholder}
            aria-label={t.panel.placeholder}
          />

          <button className="icon-btn" type="button" aria-label={t.panel.upload} title={t.panel.upload}>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="16" rx="2.5" />
              <circle cx="8.5" cy="9.5" r="1.6" />
              <path d="M21 15.2 16.4 10.6 9.6 17.4" />
              <path d="M3 17.5 7.2 13.3" />
            </svg>
          </button>

          <button
            className="icon-btn primary"
            type="button"
            aria-label={t.panel.publish}
            title={t.panel.publish}
            disabled
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21.5 2.5 10.8 13.2" />
              <path d="M21.5 2.5 14.8 21.5 10.8 13.2 2.5 9.2 21.5 2.5Z" />
            </svg>
          </button>
        </div>
      </div>

      <button
        ref={fabRef}
        className={`fab${minimized ? ' show' : ''}`}
        type="button"
        aria-hidden={!minimized}
        tabIndex={minimized ? 0 : -1}
        title={t.panel.open}
        onClick={restore}
      >
        <span className="fab-logo" aria-hidden="true">
          <Logo />
        </span>
        <span className="fab-text">{t.panel.open}</span>
        <span className="fab-count">{t.panel.comments.length}</span>
      </button>
    </>
  )
}

type CommentShape = ReturnType<typeof useI18n>['t']['panel']['comments'][number]

function Comment({
  comment,
  color,
  colorFor
}: {
  comment: CommentShape
  color: string
  colorFor: (name: string) => string
}) {
  const { t } = useI18n()

  return (
    <article className="c">
      <div className="c-main">
        <div className="c-glow" aria-hidden="true" />
        <div className="c-avatar" style={{ '--c': color } as CSSProperties}>
          {firstChar(comment.name)}
        </div>
        <div className="c-body">
          <div className="c-meta">
            <b>{comment.name}</b>
            {comment.badge ? <span className="badge">{comment.badge}</span> : null}
            <span className="c-time">{comment.time}</span>
          </div>
          <div className="c-text">
            <p>{comment.text}</p>
          </div>
          <div className="c-acts">
            <button className="act" type="button" aria-label={t.panel.like}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M7 22V11l5-9 1.5 1a3 3 0 0 1 1 3l-.5 3H19a2 2 0 0 1 2 2.2l-1 7A2 2 0 0 1 18 22H7z" />
              </svg>
              <span>{comment.likes}</span>
            </button>
            <button className="act" type="button">
              {t.panel.reply}
            </button>
          </div>
          {comment.replies.length > 0 ? (
            <div className="c-replies">
              {comment.replies.map((reply) => (
                <div className="reply" key={`${reply.name}-${reply.time}`}>
                  <div className="r-avatar" style={{ '--c': colorFor(reply.name) } as CSSProperties}>
                    {firstChar(reply.name)}
                  </div>
                  <div className="r-body">
                    <div className="c-meta">
                      <b>{reply.name}</b>
                      <span className="c-time">{reply.time}</span>
                    </div>
                    <div className="c-text">
                      <p>{reply.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}

/** First code point, so a CJK name does not get split into half a glyph. */
function firstChar(name: string): string {
  return Array.from(name)[0] ?? '?'
}
