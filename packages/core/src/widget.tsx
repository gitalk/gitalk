import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { GitalkOptions } from './types'
import { useGitalk } from './use-gitalk'
import { useStickyComposer } from './use-sticky-composer'
import { collectParticipants } from './mentions'
import { Button } from './components/button'
import { Comment } from './components/comment'
import type { CommentLabels } from './components/comment'
import { Avatar } from './components/avatar'
import { Icon } from './components/icon'
import { ImageUploadButton, ImageUploadError } from './components/image-upload'
import { MentionTextarea } from './components/mention-textarea'
import type { MentionTextareaHandle } from './components/mention-textarea'
import { buildImageMarkdown } from './images'
import { PendingCommentRow } from './components/pending-comment'
import { Upvote } from './components/upvote'
import { VERSION } from './version'

export interface GitalkProps {
  options: GitalkOptions
  className?: string
}

export function GitalkWidget({ options, className }: GitalkProps) {
  const { state, t, actions, meta } = useGitalk(options)

  /**
   * Collapse state is deliberately local and not persisted: the design
   * reference starts expanded, and a visitor who reloads expects to see the
   * comments they came for rather than a ball they have to re-open.
   */
  const [minimized, setMinimized] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)
  /** Imperative access to the composer editor, for image insertion. */
  const editorRef = useRef<MentionTextareaHandle | null>(null)

  // The composer only docks while the widget is expanded; collapsing it
  // undocks first, so the FAB is never covered by a fixed composer.
  const { docked, placeholderHeight } = useStickyComposer({
    enabled: meta.stickyComposer && !minimized,
    containerRef,
    composerRef
  })

  const { refreshPreview, closePreview } = actions

  // A collapsed widget moves focus to the only control left on screen.
  useEffect(() => {
    if (minimized) fabRef.current?.focus({ preventScroll: true })
  }, [minimized])

  // `mount.update()` can turn the option off while the widget is collapsed.
  // Expanding it here avoids leaving the widget hidden with no FAB to click.
  useEffect(() => {
    if (!meta.showMinimizable && minimized) setMinimized(false)
  }, [meta.showMinimizable, minimized])

  /**
   * A new top-level comment is prepended to the list. With the composer now
   * below the list, posting while scrolled down would otherwise hide the
   * optimistic row above the fold; the reference does the same scroll-to-top
   * in its `publish()`.
   */
  const lastPendingComment = useRef<string | null>(null)
  useEffect(() => {
    const latest = state.pending.filter((p) => p.parentId == null).at(-1)
    if (!latest || latest.key === lastPendingComment.current) return
    lastPendingComment.current = latest.key
    const list = containerRef.current?.querySelector<HTMLElement>('.gt-comments')
    if (list) list.scrollTop = 0
  }, [state.pending])

  const shellClass = [
    'gt-container',
    meta.authenticated ? 'gt-authenticated' : '',
    minimized ? 'gt-minimized' : '',
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
      discard: t('discard'),
      author: t('author')
    }),
    [t]
  )

  const topLevelPending = state.pending.filter((p) => p.parentId == null)

  /**
   * Upload the selection, then insert the generated Markdown as ONE edit.
   *
   * Inserting once (rather than once per file against a stale `value`) keeps
   * the images in selection order and makes the "all-or-nothing" rule literal:
   * a failed upload never leaves half a selection in the draft.
   */
  const uploadFiles = async (files: File[]) => {
    const images = await actions.uploadImage(files)
    if (!images) return
    editorRef.current?.insertAtCaret(images.map(buildImageMarkdown).join('\n\n'))
    // The preview is a rendered snapshot of the draft; after an insertion it
    // would be stale, so return to the source rather than calling the
    // Markdown endpoint behind the visitor's back.
    if (state.previewing) closePreview()
  }

  /**
   * Toggle the composer between source and rendered Markdown.
   *
   * The preview costs one `backend.preview()` call, so it is manual: the
   * button next to Send is the only thing that opens it. There is no debounce
   * and no effect watching the draft — typing never triggers a request.
   */
  const togglePreview = () => {
    if (!state.draft.trim()) return
    if (state.previewing) {
      closePreview()
      return
    }
    void refreshPreview()
  }

  const loginHref = meta.loginUrl ?? '#'
  const onLoginClick = (event: { preventDefault: () => void }) => {
    event.preventDefault()
    actions.login()
  }

  const expand = () => {
    setMinimized(false)
    // Restore focus to the editor the visitor collapsed from. Deferred one
    // tick because the composer is hidden by CSS until this render commits.
    setTimeout(() => {
      // The visitor may have collapsed it again before this frame.
      if (containerRef.current?.classList.contains('gt-minimized')) return
      containerRef.current
        ?.querySelector<HTMLTextAreaElement>('.gt-header-textarea')
        ?.focus({ preventScroll: true })
    }, 0)
  }

  return (
    <div
      className={shellClass}
      ref={containerRef}
      data-minimized={minimized ? 'true' : undefined}
    >
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
          {!meta.authenticated && meta.canLogin ? (
            <a
              className="gt-notice-text gt-notice-login-link"
              href={loginHref}
              onClick={onLoginClick}
            >
              {state.notice}
            </a>
          ) : (
            <span className="gt-notice-text">{state.notice}</span>
          )}
          {!meta.authenticated && meta.canLogin ? (
            <a
              className="gt-btn gt-btn-login gt-btn-notice-login"
              href={loginHref}
              onClick={onLoginClick}
            >
              <span className="gt-btn-text">{t('login-with-github')}</span>
            </a>
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

      {state.loading ? (
        <div className="gt-initing">
          {/* The brand mark, then the word: a spinner says "wait", this says
              "Gitalk is starting". */}
          <span className="gt-initing-logo" aria-hidden="true">
            <svg viewBox="0 0 1024 1024" width="40" height="40" focusable="false">
              <mask id="gt-initing-mark">
                <rect width="1024" height="1024" fill="#fff" />
                <rect x="330" y="308" width="364" height="104" rx="52" fill="#000" />
                <rect x="330" y="476" width="228" height="104" rx="52" fill="#000" />
              </mask>
              <g fill="currentColor" mask="url(#gt-initing-mark)">
                <circle cx="512" cy="444" r="300" />
                <path d="M368 700H516L360 880Z" />
              </g>
            </svg>
          </span>
          <span className="gt-initing-text">{t('init')}</span>
        </div>
      ) : null}

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
            Counts + identity read as the section header above the list, which
            is where the design reference puts its "title + count" row. The
            composer now sits below the list (reference: `.p-composer`), so it
            can dock to the viewport bottom and hang its preview above it.
          */}
          <div className="gt-meta p-head">
            <div className="gt-meta-title p-title">
              <span className="gt-title">{t('comments')}</span>
              <span
                className="gt-counts p-count"
                title={t('counts', { counts: String(loadedCount) }, loadedCount)}
              >
                <a
                  className="gt-link gt-link-counts"
                  href={state.thread?.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {loadedCount}
                </a>
              </span>
            </div>
            <div className="gt-meta-tools p-tools">
              {meta.canUpvote ? (
                <Upvote
                  upvote={state.upvote}
                  authenticated={meta.authenticated}
                  label={t('upvote')}
                  disabledReason={meta.canToggleUpvote ? undefined : t('upvote-unavailable')}
                  onToggle={(next) => void actions.setUpvote(next)}
                  onLoginRequired={() => actions.requireLogin('upvote')}
                />
              ) : null}
              {/*
                There is no "hot" segment: GitHub's API exposes no popularity
                sort, so the control would be a promise the backend cannot keep.
                "Latest" stays as a static segment to keep the reference's
                visual rhythm.
              */}
              <div className="gt-sort p-sort" role="group" aria-label={t('latest')}>
                <span className="is-active" aria-current="true">
                  {t('latest')}
                </span>
              </div>
              {meta.showMinimizable ? (
                <button
                  type="button"
                  className="gt-minimize p-min"
                  title={t('minimize')}
                  aria-label={t('minimize')}
                  onClick={() => {
                    actions.closePreview()
                    setMinimized(true)
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M5 12h14" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>

          <div
            className="gt-comments p-scroll p-list"
            style={
              meta.maxHeight == null
                ? undefined
                : { maxHeight: meta.maxHeight, overflowY: 'auto' }
            }
          >
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

          {/*
            When docked, the composer leaves the flow, so this spacer keeps the
            widget exactly as tall as it was. Without it, fixing the composer
            would shorten `.gt-container`, push its bottom above the viewport
            edge, and immediately undock — a visible one-frame loop.
          */}
          {docked && !minimized ? (
            <div
              className="gt-header-placeholder"
              style={{ height: `${placeholderHeight}px` }}
              aria-hidden="true"
            />
          ) : null}

          <div
            ref={composerRef}
            className={`gt-header p-composer${docked && !minimized ? ' is--docked' : ''}`}
            data-docked={docked && !minimized ? 'true' : undefined}
          >
            {state.user ? (
              <Avatar
                className="gt-header-avatar"
                src={state.user.avatarUrl}
                alt={state.user.login}
              />
            ) : meta.canLogin ? (
              <a
                className="gt-avatar-github"
                href={loginHref}
                onClick={onLoginClick}
              >
                <Icon className="gt-ico-github" name="github" />
              </a>
            ) : (
              <span className="gt-avatar-github gt-avatar-github-idle">
                <Icon className="gt-ico-github" name="github" />
              </span>
            )}

            <div className="gt-header-comment">
              {!meta.authenticated && meta.canLogin ? (
                /*
                 * Signed out: the composer is a sign-in prompt, not an editor.
                 * It is deliberately not dismissible — there is nothing else
                 * this row can do until the visitor signs in — and both the
                 * sentence and the button are links, so either click starts the
                 * same OAuth round trip the header notice uses.
                 */
                <div
                  className="gt-composer-login"
                  role="group"
                  aria-label={t('login-to-comment')}
                >
                  <a
                    className="gt-btn gt-btn-login gt-composer-login-btn"
                    href={loginHref}
                    onClick={onLoginClick}
                  >
                    <span className="gt-btn-text">{t('login')}</span>
                  </a>
                </div>
              ) : (
                <>
                  {/*
                    Source and preview share one body: the preview replaces the
                    editor *inside* the composer instead of floating above it,
                    so the composer's height follows whichever state is showing.
                  */}
                  <div className={`gt-composer-body${state.previewing ? ' is--preview' : ''}`}>
                    <MentionTextarea
                      className="gt-header-textarea"
                      value={state.draft}
                      candidates={candidates}
                      rows={1}
                      placeholder={t('leave-a-comment')}
                      ariaLabel={t('leave-a-comment')}
                      listLabel={t('mention-label')}
                      onSubmit={
                        (options.enableHotKey ?? true) ? () => void actions.submit() : undefined
                      }
                      onInput={actions.setDraft}
                      handleRef={editorRef}
                      // While the preview is shown the editor is hidden; an
                      // insertion then appends instead of guessing a caret.
                      caretAvailable={!state.previewing}
                    />

                    {state.previewing ? (
                      <div
                        className="gt-composer-preview"
                        role="region"
                        aria-label={t('preview')}
                      >
                        <div className="preview-head">
                          <span className="preview-label">{t('preview')}</span>
                          <span className="preview-hint">Markdown</span>
                          <span className="preview-count">
                            {t('preview-chars', { count: String(state.draft.length) })}
                          </span>
                        </div>
                        <div
                          className="preview-body markdown-body"
                          dangerouslySetInnerHTML={{ __html: state.previewHtml }}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="gt-header-controls">
                    {meta.canUploadImage ? (
                      <ImageUploadButton
                        uploading={state.imageUploading}
                        progress={state.imageUploadProgress}
                        label={t('upload-image')}
                        uploadingLabel={t('uploading-image')}
                        cancelLabel={t('cancel')}
                        onFiles={(files) => void uploadFiles(files)}
                        onCancel={actions.cancelImageUpload}
                      />
                    ) : null}

                    {/*
                      Manual source/preview switch, next to Send. It is the only
                      trigger: no draft watcher, no debounce, one request per
                      click.
                    */}
                    <button
                      type="button"
                      className="gt-btn gt-btn-preview-toggle"
                      title={state.previewing ? t('edit') : t('preview')}
                      aria-label={state.previewing ? t('edit') : t('preview')}
                      aria-pressed={state.previewing}
                      disabled={!state.draft.trim()}
                      onClick={togglePreview}
                    >
                      <Icon
                        className="gt-ico-preview"
                        name={state.previewing ? 'code' : 'preview'}
                      />
                      <span className="gt-btn-label">
                        {state.previewing ? t('edit') : t('preview')}
                      </span>
                    </button>

                    {meta.authenticated || meta.canLogin ? (
                      <Button
                        /* Signed-in visitors get the real submit control.
                           Anonymous ones get the same paper-plane affordance
                           under its own class: the click routes through
                           `actions.submit`, which answers with the sign-in
                           notice. `.gt-btn-public` stays reserved for a control
                           that can actually post. */
                        className={meta.authenticated ? 'gt-btn-public' : 'gt-btn-send'}
                        loading={state.submitting}
                        onClick={() => void actions.submit()}
                      >
                        {/* Icon-only in the reference (`.icon-btn.primary`);
                            the text stays in the DOM for the accessible name. */}
                        <Icon className="gt-ico-send" name="send" />
                        <span className="gt-btn-label">{t('comment')}</span>
                      </Button>
                    ) : null}
                  </div>
                </>
              )}

              {/*
                Failures are never silent: the reason and a retry sit directly
                below the controls. Cancellation is the one code the hook
                swallows, so a visitor-requested abort produces no row.
              */}
              {state.imageUploadError ? (
                <ImageUploadError
                  error={state.imageUploadError}
                  t={t}
                  onRetry={() => {
                    const failed = state.imageUploadError
                    if (failed) void uploadFiles(failed.files)
                  }}
                />
              ) : null}
            </div>
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

      {meta.showMinimizable && minimized ? (
        <button
          ref={fabRef}
          type="button"
          className={`gt-fab gt-fab--${meta.fabPosition}`}
          title={t('open-comments')}
          aria-label={t('open-comments')}
          onClick={expand}
        >
          <span className="gt-fab-logo" aria-hidden="true">
              {/* The brand mark: a speech bubble whose two bars stand for a root
                  comment and its reply. The mask id is static because the FAB
                  renders once per widget. */}
              <svg viewBox="0 0 1024 1024" width="18" height="18" focusable="false">
                <mask id="gt-fab-mark">
                  <rect width="1024" height="1024" fill="#fff" />
                  <rect x="330" y="308" width="364" height="104" rx="52" fill="#000" />
                  <rect x="330" y="476" width="228" height="104" rx="52" fill="#000" />
                </mask>
                <g fill="currentColor" mask="url(#gt-fab-mark)">
                  <circle cx="512" cy="444" r="300" />
                  <path d="M368 700H516L360 880Z" />
                </g>
              </svg>
            </span>
          <span className="gt-fab-text">{t('comments')}</span>
          <span className="gt-fab-count">{loadedCount}</span>
        </button>
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
