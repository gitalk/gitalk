import type { TargetedMouseEvent } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { REACTION_EMOJI, REACTION_LABEL, reactionChips } from '../reactions'
import type { GitalkReactions, Reaction } from '../types'
import { REACTIONS } from '../types'

interface ReactionPickerProps {
  reactions: GitalkReactions
  /** Signed-in viewers can pick; everyone else gets a sign-in prompt. */
  canReact: boolean
  /** Group label, e.g. "Reactions". */
  label: string
  /** Trigger label for signed-out visitors, e.g. "Add reaction". */
  addLabel: string
  onToggle: (content: Reaction) => void
  /** Called instead of `onToggle` when the viewer is anonymous. */
  onLoginRequired: () => void
}

/**
 * The reference's outline thumb, for the trigger only.
 *
 * Reaction *chips* keep GitHub's emoji (they are the point of the eight-type
 * picker); the trigger is the "like" pill of the design, so it uses the same
 * quiet stroked glyph as `.act` rather than a yellow emoji.
 */
function ThumbsUpGlyph() {
  return (
    <span className="gt-reaction-glyph" aria-hidden="true">
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
        focusable="false"
      >
        <path d="M7 22V11l5-9 1.5 1a3 3 0 0 1 1 3l-.5 3H19a2 2 0 0 1 2 2.2l-1 7A2 2 0 0 1 18 22H7z" />
      </svg>
    </span>
  )
}

/**
 * Reaction control for one comment: a chip per type that has been used, plus a
 * picker carrying all eight GitHub reaction types.
 *
 * This replaces the old heart-only button. The heart was labelled "Like" and
 * read as a bookmark/favourite; GitHub's model is a different thing — eight
 * unrelated reactions, each with its own count and its own viewer flag — and
 * the control now says so.
 */
export function ReactionPicker({
  reactions,
  canReact,
  label,
  addLabel,
  onToggle,
  onLoginRequired
}: ReactionPickerProps) {
  const [open, setOpen] = useState(false)
  // GitHub's own picker drops below the button unless the button is too close
  // to the bottom of the viewport, in which case it flips up. Doing the same
  // keeps the picker off the comment text it would otherwise cover.
  const [placement, setPlacement] = useState<'up' | 'down'>('down')
  // Viewport coordinates: the picker is fixed, so it can escape the
  // scrolling comment list instead of being clipped by it.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const chips = reactionChips(reactions)

  const pick = (e: TargetedMouseEvent<HTMLButtonElement>, content: Reaction) => {
    e.preventDefault()
    setOpen(false)
    if (canReact) onToggle(content)
    else onLoginRequired()
  }

  // Anonymous readers get one button and no picker: the click is answered with
  // a sign-in prompt instead of a request GitHub would reject.
  if (!canReact) {
    return (
      <button
        type="button"
        className="gt-comment-like gt-reaction-trigger act"
        aria-label={addLabel}
        title={addLabel}
        onClick={onLoginRequired}
      >
        <ThumbsUpGlyph />
        {reactions.totalCount ? (
          <span className="gt-reaction-count">{reactions.totalCount}</span>
        ) : null}
      </button>
    )
  }

  return (
    <div className="gt-comment-reactions" ref={root}>
      {chips.map((chip) => (
        <button
          type="button"
          key={chip.content}
          className={`gt-reaction-chip${chip.mine ? ' is--active' : ''}`}
          aria-pressed={chip.mine}
          title={REACTION_LABEL[chip.content]}
          aria-label={`${REACTION_LABEL[chip.content]} (${chip.count})`}
          onClick={(e) => pick(e, chip.content)}
        >
          <span className="gt-reaction-glyph" aria-hidden="true">
            {REACTION_EMOJI[chip.content]}
          </span>
          <span className="gt-reaction-count">{chip.count}</span>
        </button>
      ))}

      <div className="gt-reaction-add">
        <button
          type="button"
          ref={trigger}
          className="gt-comment-like gt-reaction-trigger act"
          aria-label={addLabel}
          title={addLabel}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => {
            if (!open) {
              const room = trigger.current
                ? window.innerHeight - trigger.current.getBoundingClientRect().bottom
                : Number.POSITIVE_INFINITY
              setPlacement(room < 220 ? 'up' : 'down')
              const rect = trigger.current?.getBoundingClientRect()
              if (rect) {
                // Keep it on screen: the picker is wider than a narrow comment row.
                const width = 232
                const left = Math.min(
                  Math.max(8, rect.left),
                  Math.max(8, window.innerWidth - width - 8)
                )
                setPos({
                  top: room < 220 ? rect.top - 6 : rect.bottom + 6,
                  left
                })
              }
            }
            setOpen((v) => !v)
          }}
        >
          <ThumbsUpGlyph />
          {!chips.length && reactions.totalCount ? (
            <span className="gt-reaction-count">{reactions.totalCount}</span>
          ) : null}
        </button>

        {open ? (
          <div
            className={`gt-reaction-picker is--${placement}`}
              style={
                pos
                  ? placement === 'up'
                    ? { top: undefined, bottom: window.innerHeight - pos.top, left: pos.left }
                    : { top: pos.top, left: pos.left }
                  : undefined
              }
            role="listbox"
            aria-label={label}
          >
            {REACTIONS.map((content) => {
              const mine = Boolean(reactions.viewerReactions?.[content])
              return (
                <button
                  type="button"
                  key={content}
                  role="option"
                  aria-selected={mine}
                  className={`gt-reaction-option${mine ? ' is--active' : ''}`}
                  title={REACTION_LABEL[content]}
                  aria-label={REACTION_LABEL[content]}
                  onClick={(e) => pick(e, content)}
                >
                  <span aria-hidden="true">{REACTION_EMOJI[content]}</span>
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
