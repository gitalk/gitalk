import React, { Component } from 'react'
import Avatar from './avatar'
import distanceInWordsToNow from 'date-fns/distance_in_words_to_now'
import buildDistanceInWordsLocaleZHCN from 'date-fns/locale/zh_cn/build_distance_in_words_locale/index'
import buildDistanceInWordsLocaleZHTW from 'date-fns/locale/zh_tw/build_distance_in_words_locale/index'
import 'github-markdown-css/github-markdown.css'

const ZHCN = buildDistanceInWordsLocaleZHCN()
const ZHTW = buildDistanceInWordsLocaleZHTW()
window.GT_i18n_distanceInWordsLocaleMap = {
  'zh': ZHCN,
  'zh-CN': ZHCN,
  'zh-TW': ZHTW
}

export default class Comment extends Component {
  render () {
    const { comment, user, language } = this.props
    const enableEdit = user && comment.user.login === user.login
    return (
      <div className="gt-comment">
        <Avatar className="gt-comment-avatar" src={comment.user && comment.user.avatar_url} />
        <div className="gt-comment-content">
          <div className="gt-comment-header">
            <a className="gt-comment-username" href={comment.user && comment.user.html_url}>{comment.user && comment.user.login}</a>
            <span className="gt-comment-date">
              {distanceInWordsToNow(comment.created_at, {
                addSuffix: true,
                locale: {
                  distanceInWords: window.GT_i18n_distanceInWordsLocaleMap[language]
                }
              })}
            </span>

            {enableEdit && <a href={comment.html_url} className="gt-comment-edit" />}
          </div>
          <div className="gt-comment-body markdown-body" dangerouslySetInnerHTML={{
            __html: comment.body_html
          }} />
        </div>
      </div>
    )
  }
}
