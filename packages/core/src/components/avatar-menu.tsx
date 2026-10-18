import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { Avatar } from './avatar'

interface AvatarMenuProps {
  /** GitHub login of the signed-in viewer. */
  login: string
  /** GitHub display name, when `/user` reported one. */
  displayName?: string
  avatarUrl: string
  /** Accessible name of the popup and its trigger, e.g. "Account". */
  label: string
  /** Accessible name / tooltip of the sign-out icon. */
  logoutLabel: string
  /** Whether the widget renders right-to-left. */
  rtl: boolean
  onLogout: () => void
}

interface CardPosition {
  top: number
  left: number
  placement: 'up' | 'down'
}

/** Space between the avatar and the card. */
const GAP = 8
/** Never place the card closer than this to a viewport edge. */
const EDGE = 8
/** Used before the card has been laid out (and in environments without layout). */
const FALLBACK_WIDTH = 260
const FALLBACK_HEIGHT = 54

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * One-row account card behind the signed-in composer avatar.
 *
 * Deliberately not a menu: it answers "who am I?" and "how do I sign out?" and
 * nothing else. The trigger stays the avatar in the composer; the card repeats
 * that avatar next to the identity and puts a single sign-out icon at the end.
 *
 * The card is `position: fixed` because the composer lives inside the
 * scrolling comment panel: an absolutely positioned popup there was clipped by
 * `overflow-y: auto` (the same bug the reaction picker was fixed for). Its
 * coordinates are computed from the trigger's client rect and clamped into the
 * viewport on both axes.
 */
export function AvatarMenu({
  login,
  displayName,
  avatarUrl,
  label,
  logoutLabel,
  rtl,
  onLogout
}: AvatarMenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<CardPosition | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)

  const place = useCallback(() => {
    const triggerEl = trigger.current
    if (!triggerEl) return

    const rect = triggerEl.getBoundingClientRect()
    const cardEl = card.current
    const cardRect = cardEl?.getBoundingClientRect()
    const width =
      (cardRect?.width ?? 0) > 0
        ? cardRect!.width
        : (cardEl?.offsetWidth ?? 0) > 0
          ? cardEl!.offsetWidth
          : FALLBACK_WIDTH
    const height =
      (cardRect?.height ?? 0) > 0
        ? cardRect!.height
        : (cardEl?.offsetHeight ?? 0) > 0
          ? cardEl!.offsetHeight
          : FALLBACK_HEIGHT

    const viewportWidth = window.innerWidth || width + EDGE * 2
    const viewportHeight = window.innerHeight || height + EDGE * 2

    // Prefer below, flip above when the avatar sits near the bottom edge (the
    // usual case once the composer is docked).
    const below = rect.bottom + GAP
    const above = rect.top - GAP - height
    const fitsBelow = below + height <= viewportHeight - EDGE
    const fitsAbove = above >= EDGE
    const placement: 'up' | 'down' = fitsBelow || !fitsAbove ? 'down' : 'up'

    let top = placement === 'up' ? above : below
    top = clamp(top, EDGE, Math.max(EDGE, viewportHeight - height - EDGE))

    // LTR grows rightwards from the avatar's left edge; RTL grows leftwards
    // from its right edge. Either result is then clamped into the viewport.
    const preferredLeft = rtl ? rect.right - width : rect.left
    const left = clamp(preferredLeft, EDGE, Math.max(EDGE, viewportWidth - width - EDGE))

    setPos({ top, left, placement })
  }, [rtl])

  // Measure after the card exists, then keep it glued to the trigger when the
  // page or the inner comment list scrolls.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    place()
    const update = () => place()
    window.addEventListener('resize', update)
    // Capture: the comment list is its own scroll container.
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, place])

  // Move focus into the card. Focusing the card rather than the sign-out icon
  // means a stray Enter cannot sign the visitor out before they hear where
  // they are; Tab reaches the icon next.
  useEffect(() => {
    if (!open) return
    card.current?.focus({ preventScroll: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const doc = document
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Escape is a cancel, not a navigation: focus returns to the avatar.
      trigger.current?.focus({ preventScroll: true })
    }
    doc.addEventListener('mousedown', onPointerDown)
    doc.addEventListener('keydown', onKeyDown)
    return () => {
      doc.removeEventListener('mousedown', onPointerDown)
      doc.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const triggerLabel = `${label}: @${login}`

  return (
    <div className="gt-avatar-menu-root" ref={root}>
      <button
        type="button"
        ref={trigger}
        className="gt-avatar-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={triggerLabel}
        title={triggerLabel}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar className="gt-header-avatar" src={avatarUrl} alt={login} />
      </button>

      {open ? (
        <div
          ref={card}
          className="gt-avatar-menu"
          role="dialog"
          aria-label={label}
          dir={rtl ? 'rtl' : undefined}
          tabIndex={-1}
          data-align={rtl ? 'end' : 'start'}
          data-placement={pos?.placement ?? 'down'}
          style={
            pos
              ? { top: `${pos.top}px`, left: `${pos.left}px` }
              : // First paint: measured by the layout effect above, then
                // revealed. Starting hidden avoids a one-frame jump.
                { top: '0px', left: '0px', visibility: 'hidden' }
          }
        >
          <Avatar className="gt-avatar-card-avatar" src={avatarUrl} alt={login} />

          <div className="gt-avatar-card-user">
            {displayName ? (
              <span className="gt-avatar-card-name" dir="auto">
                {displayName}
              </span>
            ) : null}
            <bdi
              dir="ltr"
              className={`gt-avatar-card-login${displayName ? ' is--secondary' : ''}`}
            >
              @{login}
            </bdi>
          </div>

          <button
            type="button"
            className="gt-avatar-card-logout"
            aria-label={logoutLabel}
            title={logoutLabel}
            onClick={() => {
              setOpen(false)
              onLogout()
            }}
          >
            <svg
              className="gt-avatar-card-logout-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
              <path d="M14 8l4 4-4 4" />
              <path d="M9 12h9" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  )
}
