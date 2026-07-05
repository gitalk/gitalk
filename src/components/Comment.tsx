import { useEffect, useRef } from 'preact/hooks'
import Avatar from './Avatar'
import Svg from './Svg'
import { formatRelativeTime } from '../utils'
import type { GitalkComment } from '../core/github/types'
import type { GitHubUser } from '../core/github/types'

interface CommentProps {
  comment: GitalkComment
  user: GitHubUser | null
  language: string
  commentedText?: string
  admin: string | string[]
  replyCallback: () => void
  likeCallback: () => void
}

export default function Comment({
  comment,
  user,
  language,
  commentedText = '',
  admin = [],
  replyCallback,
  likeCallback,
}: CommentProps) {
  const node = useRef<HTMLDivElement>(null)

  // GitHub 渲染的 bodyHTML 中隐藏邮件回复的展开/收起交互
  useEffect(() => {
    const el = node.current
    if (!el) return
    const emailResponse = el.querySelector('.email-hidden-toggle>a')
    if (!emailResponse) return
    const handle = (e: Event) => {
      e.preventDefault()
      el.querySelector('.email-hidden-reply')?.classList.toggle('expanded')
    }
    emailResponse.addEventListener('click', handle, true)
    return () => emailResponse.removeEventListener('click', handle, true)
  }, [comment.id])

  const enableEdit = user && comment.user?.login === user.login
  const isAdmin =
    comment.user &&
    ([] as string[])
      .concat(admin)
      .map((a) => a.toLowerCase())
      .includes(comment.user.login.toLowerCase())
  const reactions = comment.reactions

  let reactionTotalCount: string | number = ''
  if (reactions && reactions.totalCount) {
    reactionTotalCount = reactions.totalCount
    if (reactions.totalCount === 100 && reactions.pageInfo && reactions.pageInfo.hasNextPage) {
      reactionTotalCount = '100+'
    }
  }

  return (
    <div ref={node} className={`gt-comment ${isAdmin ? 'gt-comment-admin' : ''}`}>
      <Avatar
        className="gt-comment-avatar"
        src={comment.user && comment.user.avatar_url}
        alt={comment.user ? comment.user.login : ''}
      />

      <div className="gt-comment-content">
        <div className="gt-comment-header">
          <div className={`gt-comment-block-${user ? '2' : '1'}`} />
          <a className="gt-comment-username" href={comment.user?.html_url}>
            {comment.user && comment.user.login}
          </a>
          <span className="gt-comment-text">{commentedText}</span>
          <span className="gt-comment-date">
            {formatRelativeTime(comment.created_at, language)}
          </span>

          {reactions && (
            <a className="gt-comment-like" title="Like" onClick={likeCallback}>
              <Svg
                className="gt-ico-heart"
                name={reactions.viewerHasReacted ? 'heart_on' : 'heart'}
                text={reactionTotalCount}
              />
            </a>
          )}

          {enableEdit ? (
            <a
              href={comment.html_url}
              className="gt-comment-edit"
              title="Edit"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Svg className="gt-ico-edit" name="edit" />
            </a>
          ) : (
            <a className="gt-comment-reply" title="Reply" onClick={replyCallback}>
              <Svg className="gt-ico-reply" name="reply" />
            </a>
          )}
        </div>
        <div
          className="gt-comment-body markdown-body"
          dangerouslySetInnerHTML={{ __html: comment.body_html }}
        />
      </div>
    </div>
  )
}
