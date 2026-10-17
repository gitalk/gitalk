import { useEffect, useRef } from 'preact/hooks'
import type { MentionCandidate } from '../mentions'
import { Button } from './button'
import { MentionTextarea } from './mention-textarea'

interface ReplyBoxProps {
  value: string
  candidates: MentionCandidate[]
  submitting: boolean
  /** Fully interpolated placeholder, e.g. "Reply to alice…". */
  placeholder: string
  mentionLabel: string
  cancelLabel: string
  submitLabel: string
  onInput: (value: string) => void
  onSubmit: () => void
  onCancel: () => void
}

/**
 * The inline reply editor.
 *
 * Rendered *inside* the comment it answers — under that comment's action row,
 * exactly where the design reference puts `.reply-box` — rather than moving the
 * text up to the main composer, so it is always obvious what is being answered.
 * It shares {@link MentionTextarea} with the composer, so `@` autocomplete
 * behaves identically in both.
 */
export function ReplyBox({
  value,
  candidates,
  submitting,
  placeholder,
  mentionLabel,
  cancelLabel,
  submitLabel,
  onInput,
  onSubmit,
  onCancel
}: ReplyBoxProps) {
// Opening a reply near the bottom of the scrollable list can leave the
// submit button below the fold. Bring the box into view on mount;
// `nearest` leaves it alone when it is already visible.
const rootRef = useRef<HTMLDivElement>(null)
useEffect(() => {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  // jsdom and older engines do not implement scrollIntoView; a convenience
    // scroll must never throw and turn into an unhandled rejection.
    rootRef.current?.scrollIntoView?.({
    block: 'nearest',
    behavior: reduced ? 'auto' : 'smooth'
  })
}, [])

  return (
    <div ref={rootRef}
        className="gt-reply-box" role="group" aria-label={placeholder}>
      <MentionTextarea
        className="gt-reply-textarea"
        value={value}
        candidates={candidates}
        placeholder={placeholder}
        ariaLabel={placeholder}
        listLabel={mentionLabel}
        autoFocus
        onInput={onInput}
        onSubmit={onSubmit}
        onEscape={onCancel}
      />
      <div className="gt-reply-actions">
        <Button className="gt-btn-cancel-reply" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          className="gt-btn-public gt-btn-submit-reply"
          loading={submitting}
          disabled={!value.trim()}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
