import { formatRelativeTime } from '../time'
import type { GitalkComment, GitalkReply, PendingComment, Reaction } from '../types'
import type { MentionCandidate } from '../mentions'
import { Avatar } from './avatar'
import { Icon } from './icon'
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
  // The reply control is offered to anonymous readers too: the click then
  // answers with "sign in", which is more useful than a control that is simply
  // missing.
  const showActions = showReactions || canReply
  const needsReplyBox = canReply && onReply

  return (
    <div className={`gt-comment ${isAdmin ? 'gt-comment-admin' : ''}`}>
      <Avatar className="gt-comment-avatar" src={comment.user.avatarUrl} alt={comment.user.login} />

      <div className="gt-comment-content">
        <CommentHeader comment={comment} commentedText={labels.commented} locale={locale} />

        <div
          className="gt-comment-body markdown-body"
          dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
        />

        {/*
          Actions sit *below* the body, as in the design reference, rather than
          floating top-right: a quiet row of pills under the text.
        */}
        {showActions ? (
          <div className="gt-comment-actions">
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
                className={`gt-comment-reply${replying ? ' is--active' : ''}`}
                title={labels.reply}
                aria-expanded={replying}
                onClick={() => onReply!(comment)}
              >
                <Icon className="gt-ico-reply" name="reply" text={labels.reply} />
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
          <div className="gt-comment-replies">
            {replies.map((reply) => (
              <div className="gt-comment gt-comment-reply-item" key={reply.id}>
                <Avatar
                  className="gt-comment-avatar"
                  src={reply.user.avatarUrl}
                  alt={reply.user.login}
                />
                <div className="gt-comment-content">
                  <div className="gt-comment-header">
                    <a className="gt-comment-username" href={reply.user.htmlUrl}>
                      {reply.user.login}
                    </a>
                    <span className="gt-comment-text">{labels.commented}</span>
                    <span className="gt-comment-date">
                      {formatRelativeTime(reply.createdAt, locale)}
                    </span>
                  </div>
                  <div
                    className="gt-comment-body markdown-body"
                    dangerouslySetInnerHTML={{ __html: reply.bodyHtml }}
                  />

                  {showActions ? (
                    <div className="gt-comment-actions">
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
  )
}

function CommentHeader(props: {
  comment: GitalkComment
  commentedText: string
  locale: string
}) {
  const { comment, commentedText, locale } = props

  return (
    <div className="gt-comment-header">
      <a className="gt-comment-username" href={comment.user.htmlUrl}>
        {comment.user.login}
      </a>
      <span className="gt-comment-text">{commentedText}</span>
      <span className="gt-comment-date">{formatRelativeTime(comment.createdAt, locale)}</span>
    </div>
  )
}
