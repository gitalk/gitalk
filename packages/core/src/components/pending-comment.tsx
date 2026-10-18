import { formatRelativeTime } from '../time'
import { isRtlLocale } from '../i18n'
import type { PendingComment } from '../types'
import { Avatar } from './avatar'
import { AuthorName } from './author-name'

interface PendingCommentProps {
  pending: PendingComment
  locale: string
  /** "commented" — the verb the header prints after the login. */
  commentedText: string
  sendingText: string
  failedText: string
  retryText: string
  discardText: string
  /** Rendered inside a parent's `.gt-comment-replies` rather than at the top. */
  reply?: boolean
  onRetry: () => void
  onDiscard: () => void
}

/**
 * A comment that exists only in the browser so far.
 *
 * The body is rendered as text, not as HTML: the server-rendered markdown only
 * arrives with the confirmed comment, and rendering raw input as markup in the
 * meantime would be an injection hole for the sake of a few hundred
 * milliseconds.
 *
 * `is--sending` drives the "breathing" highlight that marks where the new
 * comment landed; `is--failed` replaces it with a red border, the reason, and
 * the two ways out (retry, discard) so the author can always tell *which*
 * comment did not go through.
 */
export function PendingCommentRow({
  pending,
  locale,
  commentedText,
  sendingText,
  failedText,
  retryText,
  discardText,
  reply,
  onRetry,
  onDiscard
}: PendingCommentProps) {
  const failed = pending.status === 'failed'
  const rtl = isRtlLocale(locale)

  return (
    <div
      className={[
        'gt-comment',
        'gt-comment--pending',
        failed ? 'is--failed' : 'is--sending',
        reply ? 'gt-comment-reply-item' : ''
      ]
        .filter(Boolean)
        .join(' ')}
      data-pending-key={pending.key}
      aria-busy={!failed}
    >
      <div className="gt-comment-main c-main">
        <Avatar
          className="gt-comment-avatar c-avatar"
          src={pending.user.avatarUrl}
          alt={pending.user.login}
        />

        <div className="gt-comment-content c-body">
          <div className="gt-comment-header c-meta">
            <AuthorName user={pending.user} rtl={rtl} />
            <span className="gt-comment-text gt-sr-only">{commentedText}</span>
            <bdi className="gt-comment-date c-time">
              {formatRelativeTime(pending.createdAt, locale)}
            </bdi>
            <span className={`gt-pending-status ${failed ? 'is--failed' : 'is--sending'}`}>
              {failed ? failedText : sendingText}
            </span>
          </div>

          <div className="gt-comment-body gt-pending-body c-text">{pending.body}</div>

          {failed ? (
            <div className="gt-pending-failure" role="alert">
              <span className="gt-pending-error">{pending.error}</span>
              <button type="button" className="gt-btn-link gt-pending-retry" onClick={onRetry}>
                {retryText}
              </button>
              <button type="button" className="gt-btn-link gt-pending-discard" onClick={onDiscard}>
                {discardText}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
