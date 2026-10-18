import type { TargetedPointerEvent } from 'preact'
import { formatRelativeTime } from '../time'
import { isRtlLocale } from '../i18n'
import type { GitalkComment, GitalkReply, PendingComment, Reaction } from '../types'
import type { MentionCandidate } from '../mentions'
import { Avatar } from './avatar'
import { AuthorName } from './author-name'
import { MarkdownBody } from './markdown-body'
import { PendingCommentRow } from './pending-comment'
import { ReactionPicker } from './reaction-picker'
import { ReplyBox } from './reply-box'

/** Everything the comment tree needs from the translator and the host. */
export interface CommentLabels {
  commented: string
  reply: string
  cancel: string
  submit: string
  reactions: string
  addReaction: string
  mentionLabel: string
  replyTo: (login: string) => string
  sending: string
  failed: string
  retry: string
  discard: string
  /** Badge printed next to an admin's name. */
  author: string
}

export interface CommentProps {
  comment: GitalkComment
  isAdmin: boolean
  locale: string
  labels: CommentLabels
  /** The reply box is open on this comment. */
  replying: boolean
  replyDraft: string
  replySubmitting: boolean
  /** Participants offered by the `@` popup. */
  candidates: MentionCandidate[]
  /** Render the reaction control at all (`GitalkOptions.reactions`). */
  showReactions: boolean
  /** The viewer is signed in. Anonymous clicks route to `onLoginRequired`. */
  authenticated: boolean
  /** Replies need a threaded backend; issues have none. */
  canReply: boolean
  /** Unconfirmed replies to this comment. */
  pending: PendingComment[]
  onReply?: (comment: GitalkComment) => void
  onReplyInput: (value: string) => void
  onReplySubmit: () => void
  onReplyCancel: () => void
  onToggleReaction?: (comment: GitalkComment | GitalkReply, content: Reaction) => void
  onLoginRequired: () => void
  onRetryPending: (key: string) => void
  onDiscardPending: (key: string) => void
}

/**
 * Tilt the row towards the pointer and move the glow to it.
 *
 * The reference's factor of 8 actually peaks at ±4deg (the offset is ±0.5),
 * so 4deg is the ceiling here. The response is quadratic instead of linear:
 * the corners still reach the cap, but half-way across the row the movement is
 * about half of what the old linear mapping produced — the "slight" tilt the
 * design calls for. Expressed as CSS variables so the transition stays in the
 * stylesheet (and so `prefers-reduced-motion` can switch the effect off
 * without JS branching).
 */
const MAX_TILT = 2

/** Map [-1, 1] to [-MAX_TILT, MAX_TILT], quadratic near the centre. */
function tiltFor(normalised: number): number {
  return Math.sign(normalised) * normalised * normalised * MAX_TILT
}

function trackPointer(event: TargetedPointerEvent<HTMLDivElement>): void {
  const row = event.currentTarget
  const rect = row.getBoundingClientRect()
  if (!rect.width || !rect.height) return

  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  const nx = (x - 0.5) * 2
  const ny = (0.5 - y) * 2

  row.style.setProperty('--ry', `${tiltFor(nx).toFixed(2)}deg`)
  row.style.setProperty('--rx', `${tiltFor(ny).toFixed(2)}deg`)
  row.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
  row.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
}

function resetPointer(event: TargetedPointerEvent<HTMLDivElement>): void {
  event.currentTarget.style.setProperty('--ry', '0deg')
  event.currentTarget.style.setProperty('--rx', '0deg')
}

export function Comment({
  comment,
  isAdmin,
  locale,
  labels,
  replying,
  replyDraft,
  replySubmitting,
  candidates,
  showReactions,
  authenticated,
  canReply,
  pending,
  onReply,
  onReplyInput,
  onReplySubmit,
  onReplyCancel,
  onToggleReaction,
  onLoginRequired,
  onRetryPending,
  onDiscardPending
}: CommentProps) {
  const replies = comment.replies ?? []
  const rtl = isRtlLocale(locale)
  // The reply control is offered to anonymous readers too: the click then
  // answers with "sign in", which is more useful than a control that is simply
  // missing.
  const showActions = showReactions || canReply
  const needsReplyBox = canReply && onReply

  return (
    <article className={`gt-comment c${isAdmin ? ' gt-comment-admin' : ''}`}>
      <div
        className="gt-comment-main c-main"
        onPointerMove={trackPointer}
        onPointerLeave={resetPointer}
      >
        <div className="gt-comment-glow c-glow" aria-hidden="true" />
        <Avatar
          className="gt-comment-avatar c-avatar"
          src={comment.user.avatarUrl}
          alt={comment.user.login}
        />

        <div className="gt-comment-content c-body">
          <div className="gt-comment-header c-meta">
            <AuthorName user={comment.user} href={comment.user.htmlUrl} rtl={rtl} />
            {isAdmin ? <span className="gt-comment-badge badge">{labels.author}</span> : null}
            <span className="gt-comment-text gt-sr-only">{labels.commented}</span>
            {/* `<bdi>` isolates the localised relative time (Persian digits
                included) so the number and its suffix cannot be reordered
                against the author name or the badge. */}
            <bdi className="gt-comment-date c-time">
              {formatRelativeTime(comment.createdAt, locale)}
            </bdi>
          </div>

          <MarkdownBody
            className="gt-comment-body c-text markdown-body"
            html={comment.bodyHtml}
            rtl={rtl}
          />

          {/*
            Actions sit *below* the body, as in the design reference, rather than
            floating top-right: a quiet row of pills under the text.
          */}
          {showActions ? (
            <div className="gt-comment-actions c-acts">
              {showReactions ? (
                <ReactionPicker
                  reactions={comment.reactions}
                  canReact={authenticated}
                  label={labels.reactions}
                  addLabel={labels.addReaction}
                  onToggle={(content) => onToggleReaction?.(comment, content)}
                  onLoginRequired={onLoginRequired}
                />
              ) : null}

              {needsReplyBox ? (
                <button
                  type="button"
                  className={`gt-comment-reply act${replying ? ' is--active' : ''}`}
                  title={labels.reply}
                  aria-expanded={replying}
                  onClick={() => onReply!(comment)}
                >
                  {labels.reply}
                </button>
              ) : null}
            </div>
          ) : null}

          {/*
            The inline reply box lives in the parent's content column, directly
            under the row it answers — the design reference's `.reply-box`.
          */}
          {replying && canReply ? (
            <ReplyBox
              value={replyDraft}
              candidates={candidates}
              submitting={replySubmitting}
              placeholder={labels.replyTo(comment.user.login)}
              mentionLabel={labels.mentionLabel}
              cancelLabel={labels.cancel}
              submitLabel={labels.submit}
              onInput={onReplyInput}
              onSubmit={onReplySubmit}
              onCancel={onReplyCancel}
            />
          ) : null}

          {replies.length || pending.length ? (
            <div className="gt-comment-replies c-replies">
              {replies.map((reply) => (
                <article className="gt-comment gt-comment-reply-item reply" key={reply.id}>
                  <div
                    className="gt-comment-main c-main"
                    onPointerMove={trackPointer}
                    onPointerLeave={resetPointer}
                  >
                    <div className="gt-comment-glow c-glow" aria-hidden="true" />
                    <Avatar
                      className="gt-comment-avatar c-avatar r-avatar"
                      src={reply.user.avatarUrl}
                      alt={reply.user.login}
                    />
                    <div className="gt-comment-content c-body r-body">
                      <div className="gt-comment-header c-meta">
                        <AuthorName user={reply.user} href={reply.user.htmlUrl} rtl={rtl} />
                        <span className="gt-comment-text gt-sr-only">{labels.commented}</span>
                        <bdi className="gt-comment-date c-time">
                          {formatRelativeTime(reply.createdAt, locale)}
                        </bdi>
                      </div>
                      <MarkdownBody
                        className="gt-comment-body c-text markdown-body"
                        html={reply.bodyHtml}
                        rtl={rtl}
                      />

                      {showActions ? (
                        <div className="gt-comment-actions c-acts">
                          {showReactions ? (
                            <ReactionPicker
                              reactions={reply.reactions}
                              canReact={authenticated}
                              label={labels.reactions}
                              addLabel={labels.addReaction}
                              onToggle={(content) => onToggleReaction?.(reply, content)}
                              onLoginRequired={onLoginRequired}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}

              {pending.map((entry) => (
                <PendingCommentRow
                  key={entry.key}
                  pending={entry}
                  reply
                  locale={locale}
                  commentedText={labels.commented}
                  sendingText={labels.sending}
                  failedText={labels.failed}
                  retryText={labels.retry}
                  discardText={labels.discard}
                  onRetry={() => onRetryPending(entry.key)}
                  onDiscard={() => onDiscardPending(entry.key)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  )
}
