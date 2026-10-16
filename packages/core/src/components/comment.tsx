import { formatRelativeTime } from '../time'
import type { GitalkComment } from '../types'
import { Avatar } from './avatar'
import { Icon } from './icon'

interface CommentProps {
  comment: GitalkComment
  isAdmin: boolean
  locale: string
  commentedText: string
  replyText: string
  canReact: boolean
  onReply?: (comment: GitalkComment) => void
  onToggleReaction?: (comment: GitalkComment) => void
}

export function Comment({
  comment,
  isAdmin,
  locale,
  commentedText,
  replyText,
  canReact,
  onReply,
  onToggleReaction
}: CommentProps) {
  const heart = comment.reactions

  return (
    <div className={`gt-comment ${isAdmin ? 'gt-comment-admin' : ''}`}>
      <Avatar className="gt-comment-avatar" src={comment.user.avatarUrl} alt={comment.user.login} />

      <div className="gt-comment-content">
        <CommentHeader comment={comment} commentedText={commentedText} locale={locale} />

        <div
          className="gt-comment-body markdown-body"
          dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
        />

        {/*
          Actions sit *below* the body, as in the design reference, rather than
          floating top-right: a quiet row of pills under the text. `canReact`
          and `onReply` are both authentication-gated, so anonymous readers get
          no empty row.
        */}
        {canReact || onReply ? (
          <div className="gt-comment-actions">
            {canReact ? (
              <a
                className={`gt-comment-like ${heart.viewerHasReacted ? 'is--liked' : ''}`}
                title="Like"
                role="button"
                tabIndex={0}
                onClick={() => onToggleReaction?.(comment)}
              >
                <Icon
                  className="gt-ico-heart"
                  name={heart.viewerHasReacted ? 'heart_on' : 'heart'}
                  text={heart.totalCount ? String(heart.totalCount) : ''}
                />
              </a>
            ) : null}

            {onReply ? (
              <a
                className="gt-comment-reply"
                title="Reply"
                role="button"
                tabIndex={0}
                onClick={() => onReply(comment)}
              >
                <Icon className="gt-ico-reply" name="reply" text={replyText} />
              </a>
            ) : null}
          </div>
        ) : null}

        {comment.replies.length ? (
          <div className="gt-comment-replies">
            {comment.replies.map((reply) => (
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
                    <span className="gt-comment-text">{commentedText}</span>
                    <span className="gt-comment-date">
                      {formatRelativeTime(reply.createdAt, locale)}
                    </span>
                  </div>
                  <div
                    className="gt-comment-body markdown-body"
                    dangerouslySetInnerHTML={{ __html: reply.bodyHtml }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function CommentHeader(props: Pick<CommentProps, 'comment' | 'commentedText' | 'locale'>) {
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
