import React from 'react'
import Avatar from './avatar'
import distanceInWordsToNow from 'date-fns/distance_in_words_to_now'

export default function Comment (props) {
  const { comment, user } = props
  const enableEdit = user && comment.user.login === user.login
  return (
    <div className="gt-comment">
      <Avatar className="gt-comment-avatar" src={comment.user && comment.user.avatar_url} />
      <div className="gt-comment-content">
        <div className="gt-comment-header">
          <a className="gt-comment-username" href={comment.user && comment.user.html_url}>{comment.user && comment.user.login}</a>
          <span className="gt-comment-date">{distanceInWordsToNow(comment.created_at, { addSuffix: 'ago' })}</span>

          {enableEdit && <a href={comment.html_url} className="gt-comment-edit"></a>}
        </div>
        <div className="gt-comment-body">
          {comment.body}
        </div>
      </div>
    </div>
  )
}
