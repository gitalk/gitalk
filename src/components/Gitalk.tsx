import { useEffect, useMemo, useRef, useState } from 'preact/hooks'

import i18n from '../i18n'
import {
  queryParse,
  queryStringify,
  formatErrorMsg,
  getMetaContent,
  hasClassInParent,
} from '../utils'
import {
  getUser,
  getIssueByNumber,
  getIssuesByLabels,
  createIssue,
  getIssueComments,
  createIssueComment,
  createCommentReaction,
  renderMarkdown,
} from '../core/github/rest'
import { getCommentsPage, removeCommentReaction } from '../core/github/graphql'
import { GitApiError } from '../core/github/error'
import {
  getStoredToken,
  storeToken,
  clearToken,
  getLoginUrl,
  exchangeCodeForToken,
} from '../core/auth'
import { resolveOptions, type GitalkOptions, type ResolvedGitalkOptions } from '../options'
import { GT_COMMENT, GT_VERSION } from '../const'
import type { GitHubIssue, GitHubUser, GitalkComment } from '../core/github/types'
import type { PagerDirection } from '../core/github/graphql'

import Avatar from './Avatar'
import Button from './Button'
import Action from './Action'
import Comment from './Comment'
import Svg from './Svg'

export interface GitalkComponentProps {
  options: GitalkOptions
}

const restoreStoredComment = (): string => {
  const stored = window.localStorage.getItem(GT_COMMENT)
  if (!stored) return ''
  window.localStorage.removeItem(GT_COMMENT)
  return decodeURIComponent(stored)
}

export default function GitalkComponent({ options: rawOptions }: GitalkComponentProps) {
  const optionsRef = useRef<ResolvedGitalkOptions>(null as unknown as ResolvedGitalkOptions)
  if (optionsRef.current === null) optionsRef.current = resolveOptions(rawOptions)
  const options = optionsRef.current

  const t = useMemo(() => i18n(options.language), [options.language])

  const [user, setUser] = useState<GitHubUser | null>(null)
  const [issue, setIssue] = useState<GitHubIssue | null>(null)
  const [comments, setComments] = useState<GitalkComment[]>([])
  const [localComments, setLocalComments] = useState<GitalkComment[]>([])
  const [comment, setComment] = useState(restoreStoredComment)
  const [pagerDirection, setPagerDirection] = useState<PagerDirection>(options.pagerDirection)
  const [previewHtml, setPreviewHtml] = useState('')

  const [isNoInit, setIsNoInit] = useState(false)
  const [isIniting, setIsIniting] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadMore, setIsLoadMore] = useState(false)
  const [isLoadOver, setIsLoadOver] = useState(false)
  const [isIssueCreating, setIsIssueCreating] = useState(false)
  const [isPopupVisible, setIsPopupVisible] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isPreview, setIsPreview] = useState(false)

  const [isOccurError, setIsOccurError] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 跨异步流程读取的最新值统一走 ref，避免闭包过期
  const tokenRef = useRef<string | null>(getStoredToken())
  const userRef = useRef<GitHubUser | null>(null)
  const issueRef = useRef<GitHubIssue | null>(null)
  const commentsRef = useRef<GitalkComment[]>([])
  const pageRef = useRef(1)
  const cursorRef = useRef<string | null>(null)
  const loadingRef = useRef(false)

  const commentEl = useRef<HTMLTextAreaElement>(null)
  const publishBtnEl = useRef<HTMLButtonElement | null>(null)

  const [accessToken, setAccessTokenState] = useState(tokenRef.current)

  const updateToken = (token: string | null) => {
    tokenRef.current = token
    setAccessTokenState(token)
    if (token) storeToken(token)
    else clearToken()
  }

  const updateUser = (u: GitHubUser | null) => {
    userRef.current = u
    setUser(u)
  }

  const updateIssue = (i: GitHubIssue | null) => {
    issueRef.current = i
    setIssue(i)
  }

  const updateComments = (cs: GitalkComment[]) => {
    commentsRef.current = cs
    setComments(cs)
  }

  const isAdminUser = (u: GitHubUser | null = userRef.current) =>
    !!u &&
    ([] as string[])
      .concat(options.admin)
      .map((a) => a.toLowerCase())
      .includes(u.login.toLowerCase())

  const showError = (err: unknown) => {
    console.error('gitalk:', err)
    setIsOccurError(true)
    setErrorMsg(formatErrorMsg(err))
  }

  // ---------- 数据流程（自 v1 GitalkComponent 平移） ----------

  const fetchUserInfo = async () => {
    if (!tokenRef.current) return
    try {
      updateUser(await getUser(tokenRef.current))
    } catch {
      updateToken(null)
      updateUser(null)
    }
  }

  const doCreateIssue = async (): Promise<GitHubIssue> => {
    const { owner, repo, title, body, id, labels, url } = options
    const created = await createIssue({
      owner,
      repo,
      title,
      labels: labels.concat(id),
      body:
        body ||
        `${url} \n\n ${
          getMetaContent('description') || getMetaContent('description', 'og:description') || ''
        }`,
      token: tokenRef.current!,
    })
    updateIssue(created)
    return created
  }

  const fetchIssueByLabels = async (): Promise<GitHubIssue | null> => {
    const { owner, repo, id, labels, createIssueManually } = options
    const issues = await getIssuesByLabels({
      owner,
      repo,
      labels: labels.concat(id),
      token: tokenRef.current,
    })
    if (!issues.length) {
      if (!createIssueManually && isAdminUser()) {
        const created = await doCreateIssue()
        setIsNoInit(false)
        return created
      }
      updateIssue(null)
      setIsNoInit(true)
      return null
    }
    updateIssue(issues[0])
    setIsNoInit(false)
    return issues[0]
  }

  const fetchIssue = async (): Promise<GitHubIssue | null> => {
    if (issueRef.current) {
      setIsNoInit(false)
      return issueRef.current
    }

    const { owner, repo, number } = options
    if (typeof number === 'number' && number > 0) {
      let found: GitHubIssue | null = null
      try {
        found = await getIssueByNumber({ owner, repo, number, token: tokenRef.current })
      } catch (err) {
        if (!(err instanceof GitApiError && err.status === 404)) throw err
      }
      if (found && found.number === number) {
        updateIssue(found)
        setIsNoInit(false)
        return found
      }
      return fetchIssueByLabels()
    }
    return fetchIssueByLabels()
  }

  const loadComments = async (target: GitHubIssue | null): Promise<GitalkComment[]> => {
    if (!target) return []

    // 登录后走 GraphQL v4（支持排序），未登录走 REST v3
    if (tokenRef.current) {
      const page = await getCommentsPage({
        owner: options.owner,
        repo: options.repo,
        issueNumber: target.number,
        perPage: options.perPage,
        pagerDirection: options.pagerDirection,
        cursor: cursorRef.current,
        token: tokenRef.current,
        defaultAuthor: options.defaultAuthor,
      })
      const cs =
        options.pagerDirection === 'last'
          ? [...page.items, ...commentsRef.current]
          : [...commentsRef.current, ...page.items]
      updateComments(cs)
      setIsLoadOver(page.isLoadOver)
      cursorRef.current = page.cursor
      return cs
    }

    const items = await getIssueComments(target.comments_url, {
      page: pageRef.current,
      perPage: options.perPage,
      token: null,
    })
    const cs = commentsRef.current.concat(items)
    setIsLoadOver(cs.length >= target.comments || items.length < options.perPage)
    updateComments(cs)
    pageRef.current += 1
    return cs
  }

  const init = async () => {
    await fetchUserInfo()
    const target = await fetchIssue()
    if (target) await loadComments(target)
  }

  useEffect(() => {
    const query = queryParse()
    if (query.code) {
      const code = query.code
      delete query.code
      const queryString = queryStringify(query)
      const replacedUrl = `${window.location.origin}${window.location.pathname}${
        queryString ? `?${queryString}` : ''
      }${window.location.hash}`
      history.replaceState(null, '', replacedUrl)
      // 与 v1 一致：登录回跳后以去掉 code 的地址作为默认 url/id，用户显式配置仍优先
      optionsRef.current = {
        ...options,
        url: replacedUrl,
        id: replacedUrl,
        ...rawOptions,
      }

      exchangeCodeForToken({
        code,
        proxy: options.proxy,
        clientID: options.clientID,
        clientSecret: options.clientSecret,
      })
        .then((token) => {
          updateToken(token)
          return init()
        })
        .catch(showError)
        .finally(() => setIsIniting(false))
    } else {
      init()
        .catch(showError)
        .finally(() => setIsIniting(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------- 交互 ----------

  const handleLogin = () => {
    window.localStorage.setItem(GT_COMMENT, encodeURIComponent(comment))
    window.location.href = getLoginUrl(options.clientID)
  }

  const handleLogout = () => {
    updateToken(null)
    updateUser(null)
    window.location.reload()
  }

  const handleIssueCreate = () => {
    setIsIssueCreating(true)
    doCreateIssue()
      .then(async (created) => {
        setIsIssueCreating(false)
        setIsOccurError(false)
        const cs = await loadComments(created)
        if (cs) setIsNoInit(false)
      })
      .catch((err) => {
        setIsIssueCreating(false)
        showError(err)
      })
  }

  const handleCommentCreate = (e?: Event) => {
    if (!comment.length) {
      e?.preventDefault()
      commentEl.current?.focus()
      return
    }
    if (isCreating) return
    setIsCreating(true)
    ;(async () => {
      const target = await fetchIssue()
      if (!target) throw new Error('no issue to comment on')
      const created = await createIssueComment(target.comments_url, comment, tokenRef.current!)
      setComment('')
      updateComments(commentsRef.current.concat(created))
      setLocalComments((prev) => prev.concat(created))
      setIsCreating(false)
      setIsOccurError(false)
    })().catch((err) => {
      setIsCreating(false)
      showError(err)
    })
  }

  const handleCommentPreview = () => {
    const next = !isPreview
    setIsPreview(next)
    if (!next) return
    renderMarkdown(comment, tokenRef.current).then(setPreviewHtml).catch(showError)
  }

  const handleCommentLoad = () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setIsLoadMore(true)
    loadComments(issueRef.current)
      .catch(showError)
      .finally(() => {
        loadingRef.current = false
        setIsLoadMore(false)
      })
  }

  const handleReply = (replyComment: GitalkComment) => () => {
    const replyCommentBody = replyComment.body ?? ''
    let replyCommentArray = replyCommentBody.split('\n')
    replyCommentArray.unshift(`@${replyComment.user?.login ?? ''}`)
    replyCommentArray = replyCommentArray.map((item) => `> ${item}`)
    replyCommentArray.push('', '')
    if (comment) replyCommentArray.unshift('')
    setComment(comment + replyCommentArray.join('\n'))
    commentEl.current?.focus()
  }

  const handleLike = (target: GitalkComment) => {
    createCommentReaction({
      owner: options.owner,
      repo: options.repo,
      commentId: target.id,
      token: tokenRef.current!,
    })
      .then((reaction) => {
        const next = commentsRef.current.map((c) => {
          if (c.id !== target.id) return c
          const reactions = c.reactions
            ? { ...c.reactions, nodes: [...c.reactions.nodes] }
            : { totalCount: 0, viewerHasReacted: false, nodes: [] }
          if (!reactions.nodes.some((n) => n.user.login === userRef.current?.login)) {
            reactions.totalCount += 1
          }
          reactions.nodes.push({
            ...reaction,
            user: reaction.user ?? { login: userRef.current?.login ?? '' },
          })
          reactions.viewerHasReacted = true
          return { ...c, reactions }
        })
        updateComments(next)
      })
      .catch(showError)
  }

  const handleUnlike = (target: GitalkComment) => {
    if (!target.gId) return
    removeCommentReaction(target.gId, tokenRef.current!)
      .then(() => {
        const next = commentsRef.current.map((c) => {
          if (c.id !== target.id || !c.reactions) return c
          const nodes = [...c.reactions.nodes]
          const index = nodes.findIndex((n) => n.user.login === userRef.current?.login)
          let totalCount = c.reactions.totalCount
          if (index >= 0) {
            totalCount -= 1
            nodes.splice(index, 1)
          }
          return { ...c, reactions: { ...c.reactions, nodes, totalCount, viewerHasReacted: false } }
        })
        updateComments(next)
      })
      .catch(showError)
  }

  const handlePopup = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const visible = !isPopupVisible
    const hideHandle = (e1: MouseEvent) => {
      if (hasClassInParent(e1.target as Element, 'gt-user', 'gt-popup')) return
      window.document.removeEventListener('click', hideHandle)
      setIsPopupVisible(false)
    }
    setIsPopupVisible(visible)
    if (visible) window.document.addEventListener('click', hideHandle)
    else window.document.removeEventListener('click', hideHandle)
  }

  const handleCommentFocus = (e: FocusEvent) => {
    if (!options.distractionFreeMode) return e.preventDefault()
    setIsInputFocused(true)
  }

  const handleCommentBlur = (e: FocusEvent) => {
    if (!options.distractionFreeMode) return e.preventDefault()
    setIsInputFocused(false)
  }

  const handleCommentKeyDown = (e: KeyboardEvent) => {
    if (options.enableHotKey && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      publishBtnEl.current?.focus()
      handleCommentCreate()
    }
  }

  // textarea 高度自适应（替代 autosize）
  useEffect(() => {
    const el = commentEl.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [comment, isPreview])

  // 评论数回调（v1 在 render 中调用，v2 移到 effect）
  const commentCount = (issue ? issue.comments : 0) + localComments.length
  useEffect(() => {
    const { updateCountCallback } = options
    if (typeof updateCountCallback !== 'function') return
    try {
      updateCountCallback(commentCount)
    } catch (err) {
      console.error('An error occurred executing the updateCountCallback:', err)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentCount])

  // ---------- 渲染块（自 v1 平移，DOM 结构与 className 保持不变） ----------

  const initingBlock = (
    <div className="gt-initing">
      <i className="gt-loader" />
      <p className="gt-initing-text">{t.t('init')}</p>
    </div>
  )

  const noInitBlock = (
    <div className="gt-no-init" key="no-init">
      <p
        dangerouslySetInnerHTML={{
          __html: t.t('no-found-related', {
            link: `<a href="https://github.com/${options.owner}/${options.repo}/issues">Issues</a>`,
          }),
        }}
      />
      <p>
        {t.t('please-contact', {
          user: ([] as string[])
            .concat(options.admin)
            .map((u) => `@${u}`)
            .join(' '),
        })}
      </p>
      {isAdminUser(user) ? (
        <p>
          <Button
            onClick={handleIssueCreate}
            isLoading={isIssueCreating}
            text={t.t('init-issue')}
          />
        </p>
      ) : null}
      {!user && (
        <Button className="gt-btn-login" onClick={handleLogin} text={t.t('login-with-github')} />
      )}
    </div>
  )

  const headerBlock = (
    <div className="gt-header" key="header">
      {user ? (
        <Avatar className="gt-header-avatar" src={user.avatar_url} alt={user.login} />
      ) : (
        <a className="gt-avatar-github" onClick={handleLogin}>
          <Svg className="gt-ico-github" name="github" />
        </a>
      )}
      <div className="gt-header-comment">
        <textarea
          ref={commentEl}
          className={`gt-header-textarea ${isPreview ? 'hide' : ''}`}
          value={comment}
          onInput={(e) => setComment((e.target as HTMLTextAreaElement).value)}
          onFocus={handleCommentFocus}
          onBlur={handleCommentBlur}
          onKeyDown={handleCommentKeyDown}
          placeholder={t.t('leave-a-comment')}
        />
        <div
          className={`gt-header-preview markdown-body ${isPreview ? '' : 'hide'}`}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
        <div className="gt-header-controls">
          <a
            className="gt-header-controls-tip"
            href="https://guides.github.com/features/mastering-markdown/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Svg className="gt-ico-tip" name="tip" text={t.t('support-markdown')} />
          </a>
          {user && (
            <Button
              getRef={(el) => {
                publishBtnEl.current = el
              }}
              className="gt-btn-public"
              onClick={handleCommentCreate}
              text={t.t('comment')}
              isLoading={isCreating}
            />
          )}
          <Button
            className="gt-btn-preview"
            onClick={handleCommentPreview}
            text={isPreview ? t.t('edit') : t.t('preview')}
          />
          {!user && (
            <Button
              className="gt-btn-login"
              onClick={handleLogin}
              text={t.t('login-with-github')}
            />
          )}
        </div>
      </div>
    </div>
  )

  const totalComments = comments.concat()
  if (pagerDirection === 'last' && accessToken) {
    totalComments.reverse()
  }

  const commentsBlock = (
    <div className="gt-comments" key="comments">
      {totalComments.map((c) => (
        <Comment
          comment={c}
          key={c.id}
          user={user}
          language={options.language}
          commentedText={t.t('commented')}
          admin={options.admin}
          replyCallback={handleReply(c)}
          likeCallback={
            c.reactions && c.reactions.viewerHasReacted
              ? () => handleUnlike(c)
              : () => handleLike(c)
          }
        />
      ))}
      {!totalComments.length && <p className="gt-comments-null">{t.t('first-comment-person')}</p>}
      {!isLoadOver && totalComments.length ? (
        <div className="gt-comments-controls">
          <Button
            className="gt-btn-loadmore"
            onClick={handleCommentLoad}
            isLoading={isLoadMore}
            text={t.t('load-more')}
          />
        </div>
      ) : null}
    </div>
  )

  const isDesc = pagerDirection === 'last'
  const metaBlock = (
    <div className="gt-meta" key="meta">
      <span
        className="gt-counts"
        dangerouslySetInnerHTML={{
          __html: t.t('counts', {
            counts: `<a class="gt-link gt-link-counts" href="${
              issue && issue.html_url
            }" target="_blank" rel="noopener noreferrer">${commentCount}</a>`,
            smart_count: commentCount,
          }),
        }}
      />
      {isPopupVisible && (
        <div className="gt-popup">
          {user ? (
            <Action
              className={`gt-action-sortasc${!isDesc ? ' is--active' : ''}`}
              onClick={() => setPagerDirection('first')}
              text={t.t('sort-asc')}
            />
          ) : null}
          {user ? (
            <Action
              className={`gt-action-sortdesc${isDesc ? ' is--active' : ''}`}
              onClick={() => setPagerDirection('last')}
              text={t.t('sort-desc')}
            />
          ) : null}
          {user ? (
            <Action className="gt-action-logout" onClick={handleLogout} text={t.t('logout')} />
          ) : (
            <a className="gt-action gt-action-login" onClick={handleLogin}>
              {t.t('login-with-github')}
            </a>
          )}
          <div className="gt-copyright">
            <a
              className="gt-link gt-link-project"
              href="https://github.com/gitalk/gitalk"
              target="_blank"
              rel="noopener noreferrer"
            >
              Gitalk
            </a>
            <span className="gt-version">{GT_VERSION}</span>
          </div>
        </div>
      )}
      <div className="gt-user">
        <div
          className={isPopupVisible ? 'gt-user-inner is--poping' : 'gt-user-inner'}
          onClick={handlePopup}
        >
          <span className="gt-user-name">{user ? user.login : t.t('anonymous')}</span>
          <Svg className="gt-ico-arrdown" name="arrow_down" />
        </div>
      </div>
    </div>
  )

  return (
    <div className={`gt-container${isInputFocused ? ' gt-input-focused' : ''}`}>
      {isIniting && initingBlock}
      {!isIniting && !isNoInit && metaBlock}
      {isOccurError && <div className="gt-error">{errorMsg}</div>}
      {!isIniting && (isNoInit ? noInitBlock : [headerBlock, commentsBlock])}
    </div>
  )
}
