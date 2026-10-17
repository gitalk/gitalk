import type { UpvoteState } from '../types'

interface UpvoteProps {
  upvote: UpvoteState | null
  authenticated: boolean
  /** Localised label, e.g. "Upvote". */
  label: string
  /**
   * Why the control cannot be pressed, if it cannot.
   *
   * Set for GitHub App user tokens: GitHub rejects the mutation for app-issued
   * tokens, so the count is still shown but the button is inert and says why.
   * https://github.com/orgs/community/discussions/3968
   */
  disabledReason?: string
  onToggle: (next: boolean) => void
  /** Called instead of `onToggle` when the viewer is anonymous. */
  onLoginRequired: () => void
}

/**
 * Discussion-level upvote.
 *
 * Distinct from a reaction on purpose: an upvote is about the *discussion*
 * (GitHub's `addUpvote`), not about a comment, and it is the thing readers use
 * to say "this page's comment thread was worth reading". It only ever renders
 * when the backend reports `supportsUpvote`, so an Issues-backed widget shows
 * nothing at all rather than a control that cannot work.
 */
export function Upvote({
  upvote,
  authenticated,
  label,
  disabledReason,
  onToggle,
  onLoginRequired
}: UpvoteProps) {
  const active = Boolean(upvote?.viewerHasUpvoted)
  // Anonymous visitors never see a count: `upvoteCount` is a GraphQL field and
  // GraphQL refuses anonymous callers outright.
  const count = authenticated ? (upvote?.count ?? 0) : null
  const disabled = Boolean(disabledReason)
  // A disabled button must explain itself, otherwise it reads as a bug.
  const title = disabled ? disabledReason! : label

  return (
    <button
      type="button"
      className={`gt-upvote${active ? ' is--active' : ''}`}
      aria-pressed={active}
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        if (authenticated) onToggle(!active)
        else onLoginRequired()
      }}
    >
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
        <path
          d="M12 4l7 8h-4v8h-6v-8H5l7-8z"
          fill={active ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      <span className="gt-upvote-label">{label}</span>
      {count !== null && count > 0 ? <span className="gt-upvote-count">{count}</span> : null}
    </button>
  )
}
