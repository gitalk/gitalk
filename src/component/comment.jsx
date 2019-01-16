import React, { Component } from 'react'
import Avatar from './avatar'
import Svg from './svg'
import distanceInWordsToNow from 'date-fns/distance_in_words_to_now'
import buildDistanceInWordsLocaleZHCN from 'date-fns/locale/zh_cn/build_distance_in_words_locale/index'
import buildDistanceInWordsLocaleZHTW from 'date-fns/locale/zh_tw/build_distance_in_words_locale/index'
import buildDistanceInWordsLocaleES from 'date-fns/locale/es/build_distance_in_words_locale/index'
import buildDistanceInWordsLocaleFR from 'date-fns/locale/fr/build_distance_in_words_locale/index'
import buildDistanceInWordsLocaleRU from 'date-fns/locale/ru/build_distance_in_words_locale/index'
import 'github-markdown-css/github-markdown.css'

const ZHCN = buildDistanceInWordsLocaleZHCN()
const ZHTW = buildDistanceInWordsLocaleZHTW()
const ES = buildDistanceInWordsLocaleES()
const FR = buildDistanceInWordsLocaleFR()
const RU = buildDistanceInWordsLocaleRU()

if (typeof window !== `undefined`) {
  window.GT_i18n_distanceInWordsLocaleMap = {
    zh: ZHCN,
    'zh-CN': ZHCN,
    'zh-TW': ZHTW,
    'es-ES': ES,
    fr: FR,
    ru: RU
  }
}


export default class Comment extends Component {
  render () {
    const {
      comment,
      user,
      language,
      commentedText = '',
      admin = [],
      replyCallback,
      likeCallback
    } = this.props
    const enableEdit = user && comment.user.login === user.login
    const isAdmin = ~[]
      .concat(admin)
      .map(a => a.toLowerCase())
      .indexOf(comment.user.login.toLowerCase())
    const reactions = comment.reactions

    let reactionTotalCount = ''
    if (reactions && reactions.totalCount) {
      reactionTotalCount = reactions.totalCount
      if (
        reactions.totalCount === 100 &&
        reactions.pageInfo &&
        reactions.pageInfo.hasNextPage
      ) {
        reactionTotalCount = '100+'
      }
    }

    return (
      <div className={`gt-comment ${isAdmin ? 'gt-comment-admin' : ''}`}>
        <Avatar
          className="gt-comment-avatar"
          src={comment.user && comment.user.avatar_url}
        />

        <div className="gt-comment-content">
          <div className="gt-comment-header">
            <a
              className="gt-comment-username"
              href={comment.user && comment.user.html_url}
            >
              {comment.user && comment.user.login}
            </a>
            <span className="gt-comment-text">{commentedText}</span>
            <span className="gt-comment-date">
              {distanceInWordsToNow(comment.created_at, {
                addSuffix: true,
                locale: {
                  distanceInWords:
                    window.GT_i18n_distanceInWordsLocaleMap[language]
                }
              })}
            </span>

            {reactions && (
              <a className="gt-comment-like" onClick={likeCallback}>
                {reactions.viewerHasReacted ? (
                  <Svg
                    className="gt-ico-heart"
                    name="heart_on"
                    text={reactionTotalCount}
                  />
                ) : (
                  <Svg
                    className="gt-ico-heart"
                    name="heart"
                    text={reactionTotalCount}
                  />
                )}
              </a>
            )}

            {enableEdit ? (
              <a
                href={comment.html_url}
                className="gt-comment-edit"
                target="_blank"
              >
                <Svg className="gt-ico-edit" name="edit" />
              </a>
            ) : (
              <a className="gt-comment-reply" onClick={replyCallback}>
                <Svg className="gt-ico-reply" name="reply" />
              </a>
            )}
          </div>
          <div
            className="gt-comment-body markdown-body"
            dangerouslySetInnerHTML={{
              __html: comment.body_html
            }}
          />
        </div>
      </div>
    )
  }
}
