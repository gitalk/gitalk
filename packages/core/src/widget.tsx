import type { TargetedKeyboardEvent } from 'preact'
import type { GitalkOptions } from './types'
import { useGitalk } from './use-gitalk'
import { Avatar } from './components/avatar'
import { Button } from './components/button'
import { Comment } from './components/comment'
import { Icon } from './components/icon'
import { VERSION } from './version'

export interface GitalkProps {
  options: GitalkOptions
  className?: string
}

export function GitalkWidget({ options, className }: GitalkProps) {
  const { state, t, actions, meta } = useGitalk(options)

  const shellClass = [
    'gt-container',
    meta.authenticated ? 'gt-authenticated' : '',
    className ?? ''
  ]
    .filter(Boolean)
    .join(' ')

  const handleKeyDown = (e: TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    const opts = options.enableHotKey ?? true
    if (opts && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      void actions.submit()
    }
  }

  // Replies are nested inside their parent, so the top-level array length is
  // not the number of comments on the page — a thread showing three comments
  // read as two.
  const loadedCount = state.comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0)

  return (
    <div className={shellClass}>
      {state.error ? (
        <div className="gt-error">
          {state.error}
          {state.rateLimited ? (
            <span className="gt-error-hint">
              {' '}
              Anonymous requests are limited to 60/hour per IP. Sign in to raise the limit.
            </span>
          ) : null}
        </div>
      ) : null}

      {state.loading ? <div className="gt-initing">{t('init')}</div> : null}

      {state.ready && state.missingThread ? (
        <div className="gt-no-init">
          <p>{t('no-found-related', { link: threadLink(meta.owner, meta.repo) })}</p>
          <p>{t('please-contact', { user: options.admin.map((a) => `@${a}`).join(' ') })}</p>
          {meta.isAdmin ? (
            <Button className="gt-btn-init" onClick={() => void actions.createThread()}>
              {t('init-issue')}
            </Button>
          ) : null}
          {!meta.authenticated && meta.canLogin ? (
            <Button className="gt-btn-login" onClick={actions.login}>
              {t('login-with-github')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {state.ready && !state.missingThread ? (
        <>
          <div className="gt-header">
            {state.user ? (
              <Avatar className="gt-header-avatar" src={state.user.avatarUrl} alt={state.user.login} />
            ) : meta.canLogin ? (
              <a
                className="gt-avatar-github"
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  actions.login()
                }}
              >
                <Icon className="gt-ico-github" name="github" />
              </a>
            ) : (
              <span className="gt-avatar-github gt-avatar-github-idle">
                <Icon className="gt-ico-github" name="github" />
              </span>
            )}

            <div className="gt-header-comment">
              <textarea
                className={`gt-header-textarea ${state.previewing ? 'hide' : ''}`}
                value={state.draft}
                placeholder={t('leave-a-comment')}
                onInput={(e) => actions.setDraft(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
              />

              {state.previewing ? (
                <div
                  className="gt-header-preview markdown-body"
                  dangerouslySetInnerHTML={{ __html: state.previewHtml }}
                />
              ) : null}

              <div className="gt-header-controls">
                <a
                  className="gt-header-controls-tip"
                  href="https://docs.github.com/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon className="gt-ico-tip" name="tip" text={t('support-markdown')} />
                </a>

                {meta.authenticated ? (
                  <Button className="gt-btn-public" loading={state.submitting} onClick={() => void actions.submit()}>
                    {t('comment')}
                  </Button>
                ) : null}

                <Button className="gt-btn-preview" onClick={() => void actions.togglePreview()}>
                  {state.previewing ? t('edit') : t('preview')}
                </Button>

                {!meta.authenticated && meta.canLogin ? (
                  <Button className="gt-btn-login" onClick={actions.login}>
                    {t('login-with-github')}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="gt-comments">
            {state.comments.length ? (
              state.comments.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  locale={options.language ?? navigator.language}
                  commentedText={t('commented')}
                  isAdmin={options.admin.some((a) => a.toLowerCase() === comment.user.login.toLowerCase())}
                  canReact={meta.authenticated}
                  onReply={meta.authenticated ? actions.replyTo : undefined}
                  onToggleReaction={meta.authenticated ? actions.toggleReaction : undefined}
                />
              ))
            ) : (
              <p className="gt-comments-null">{t('first-comment-person')}</p>
            )}

            {state.hasMore ? (
              <div className="gt-comments-controls">
                <Button className="gt-btn-loadmore" loading={state.loadingMore} onClick={() => void actions.loadMore()}>
                  {t('load-more')}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="gt-meta">
            <span
              className="gt-counts"
              dangerouslySetInnerHTML={{
                __html: t(
                  'counts',
                  {
                    counts: `<a class="gt-link gt-link-counts" href="${state.thread?.url ?? '#'}" target="_blank" rel="noopener noreferrer">${loadedCount}</a>`
                  },
                  loadedCount
                )
              }}
            />
            <div className="gt-user">
              {meta.authenticated ? (
                <span className="gt-user-name">{state.user?.login ?? t('anonymous')}</span>
              ) : (
                <span className="gt-user-name">{t('anonymous')}</span>
              )}
            </div>
            <div className="gt-copyright">
              <a
                className="gt-link gt-link-project"
                href="https://github.com/gitalk/gitalk"
                target="_blank"
                rel="noopener noreferrer"
              >
                Gitalk
              </a>
              <span className="gt-version">{VERSION}</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function threadLink(owner: string, repo: string): string {
  const href = `https://github.com/${owner}/${repo}/discussions`
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${escapeHtml(href)}</a>`
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}
