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
  return (
    <div className="gt-reply-box" role="group" aria-label={placeholder}>
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
