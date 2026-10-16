import { useMemo } from 'preact/hooks'
import type { GitalkOptions } from './types'
import { useGitalk } from './use-gitalk'
import { collectParticipants } from './mentions'
import { Avatar } from './components/avatar'
import { Button } from './components/button'
import { Comment } from './components/comment'
import type { CommentLabels } from './components/comment'
import { Icon } from './components/icon'
import { MentionTextarea } from './components/mention-textarea'
import { PendingCommentRow } from './components/pending-comment'
import { Upvote } from './components/upvote'
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

  // Replies are nested inside their parent, so the top-level array length is
  // not the number of comments on the page — a thread showing three comments
  // read as two.
  const loadedCount = state.comments.reduce((n, c) => n + 1 + (c.replies?.length ?? 0), 0)

  // Who the `@` popup may offer: everyone who has written in the loaded thread,
  // minus the viewer. Computed from the confirmed comments only — a pending
  // comment is not a participant yet.
  const candidates = useMemo(
    () => (meta.showMentions ? collectParticipants(state.comments, state.user?.login ?? null) : []),
    [meta.showMentions, state.comments, state.user]
  )

  const labels: CommentLabels = useMemo(
    () => ({
      commented: t('commented'),
      reply: t('reply'),
      cancel: t('cancel'),
      submit: t('comment'),
      reactions: t('reactions-label'),
      addReaction: t('add-reaction'),
      mentionLabel: t('mention-label'),
      replyTo: (login: string) => t('reply-to', { user: login }),
      sending: t('sending'),
      failed: t('not-posted'),
      retry: t('retry'),
      discard: t('discard')
    }),
    [t]
  )

  const topLevelPending = state.pending.filter((p) => p.parentId == null)

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

      {/*
        An anonymous click on a write control lands here: a visible, dismissible
        answer with the sign-in button next to it, instead of a click that
        silently does nothing.
      */}
      {state.notice ? (
        <div className="gt-notice" role="status">
          <span className="gt-notice-text">{state.notice}</span>
          {!meta.authenticated && meta.canLogin ? (
            <Button className="gt-btn-login gt-btn-notice-login" onClick={actions.login}>
              {t('login-with-github')}
            </Button>
          ) : null}
          <button
            type="button"
            className="gt-notice-close"
            aria-label={t('dismiss')}
            onClick={actions.dismissNotice}
          >
            ×
          </button>
        </div>
      ) : null}

      {state.loading ? <div className="gt-initing">{t('init')}</div> : null}

      {/*
        Admin auto-creation (createIssueManually: false) keeps `creatingThread`
        set while the thread is being made, so this block — and the button in
        it — only appears once there really is nothing to show. The
        "initializing" line above covers that window instead.
      */}
      {state.ready && state.missingThread && !state.creatingThread ? (
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
          {/*
            Counts + identity read as the section header above the composer,
            which is where the design reference puts its "title + count" row.
            The copyright line moved out to its own footer at the end.
          */}
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
            <div className="gt-meta-right">
              {meta.canUpvote ? (
                <Upvote
                  upvote={state.upvote}
                  authenticated={meta.authenticated}
                  label={t('upvote')}
                  onToggle={(next) => void actions.setUpvote(next)}
                  onLoginRequired={() => actions.requireLogin('upvote')}
                />
              ) : null}
              <div className="gt-user">
                {meta.authenticated ? (
                  <span className="gt-user-name">{state.user?.login ?? t('anonymous')}</span>
                ) : (
                  <span className="gt-user-name">{t('anonymous')}</span>
                )}
              </div>
            </div>
          </div>

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
              <MentionTextarea
                className={`gt-header-textarea ${state.previewing ? 'hide' : ''}`}
                value={state.draft}
                candidates={candidates}
                placeholder={t('leave-a-comment')}
                ariaLabel={t('leave-a-comment')}
                listLabel={t('mention-label')}
                onSubmit={
                  (options.enableHotKey ?? true) ? () => void actions.submit() : undefined
                }
                onInput={actions.setDraft}
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
            {/*
              Optimistic rows go on top: they are the newest comments, which is
              where the newest-first list would put them anyway.
            */}
            {topLevelPending.map((entry) => (
              <PendingCommentRow
                key={entry.key}
                pending={entry}
                locale={options.language ?? navigator.language}
                commentedText={t('commented')}
                sendingText={t('sending')}
                failedText={t('not-posted')}
                retryText={t('retry')}
                discardText={t('discard')}
                onRetry={() => void actions.retryPending(entry.key)}
                onDiscard={() => actions.dismissPending(entry.key)}
              />
            ))}

            {state.comments.length || topLevelPending.length ? (
              state.comments.map((comment) => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  locale={options.language ?? navigator.language}
                  labels={labels}
                  isAdmin={options.admin.some((a) => a.toLowerCase() === comment.user.login.toLowerCase())}
                  replying={state.replyTarget?.id === comment.id}
                  replyDraft={state.replyDraft}
                  replySubmitting={state.replySubmitting}
                  candidates={candidates}
                  showReactions={meta.showReactions}
                  authenticated={meta.authenticated}
                  canReply={meta.canReply}
                  pending={state.pending.filter((p) => p.parentId === comment.id)}
                  onReply={
                    meta.authenticated
                      ? actions.replyTo
                      : () => actions.requireLogin('reply')
                  }
                  onReplyInput={actions.setReplyDraft}
                  onReplySubmit={() => void actions.submitReply()}
                  onReplyCancel={actions.cancelReply}
                  onToggleReaction={actions.toggleReaction}
                  onLoginRequired={() => actions.requireLogin('react')}
                  onRetryPending={(key) => void actions.retryPending(key)}
                  onDiscardPending={actions.dismissPending}
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
