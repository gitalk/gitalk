import type { TargetedInputEvent, TargetedKeyboardEvent, TargetedMouseEvent } from 'preact'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { MentionCandidate } from '../mentions'
import { filterCandidates, insertMention, mentionQueryAt } from '../mentions'
import { Avatar } from './avatar'

/**
 * Imperative editor handle.
 *
 * Host UI (currently image upload) needs to insert generated Markdown at the
 * caret without reaching into the textarea's DOM node. The component owns the
 * caret bookkeeping, so it exposes the one operation instead.
 */
export interface MentionTextareaHandle {
  /**
   * Insert `text` at the caret, replacing the selection when there is one.
   * Appends to the end when the editor is hidden (the Markdown preview) and
   * therefore cannot report a trustworthy caret.
   */
  insertAtCaret: (text: string) => void
}

interface MentionTextareaProps {
  value: string
  candidates: MentionCandidate[]
  className?: string
  placeholder?: string
  autoFocus?: boolean
  /** Visible rows; the top composer passes 1 for its single-line bar. */
  rows?: number
  /** Label for the popup, e.g. "Mention a participant". */
  listLabel: string
  ariaLabel?: string
  /** Cmd/Ctrl+Enter. Omitted when the host has hot keys switched off. */
  onSubmit?: () => void
  /** Submit on a bare Enter. Off unless the host opts in. */
  submitOnPlainEnter?: boolean
  onInput: (value: string) => void
  /** Esc pressed with no popup open (the reply box uses it to cancel). */
  onEscape?: () => void
  /** Filled with the imperative handle for the lifetime of the component. */
  handleRef?: { current: MentionTextareaHandle | null }
  /** False while a preview hides the editor; insertion then appends. */
  caretAvailable?: boolean
}

let listSeq = 0

/**
 * The comment editor.
 *
 * One component for both the top composer and the inline reply box, so the
 * `@` autocomplete exists once: caret-aware insertion, prefix filtering,
 * ArrowUp/ArrowDown + Enter/Tab to pick, Escape to dismiss, click to pick, and
 * click-outside to close.
 */
export function MentionTextarea({
  value,
  candidates,
  className,
  placeholder,
  autoFocus,
  rows,
  listLabel,
  ariaLabel,
  onSubmit,
  submitOnPlainEnter,
  onInput,
  onEscape,
  handleRef,
  caretAvailable = true
}: MentionTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [token, setToken] = useState<{ start: number; query: string } | null>(null)
  const [active, setActive] = useState(0)
  // Restored after the controlled value re-renders: without it the caret jumps
  // to the end of the text every time a mention is inserted.
  const pendingCaret = useRef<number | null>(null)
  /**
   * Text the pending caret belongs to.
   *
   * Effects are deferred and may fire from an *older* render after an async
   * insertion has already queued the next one. Applying the caret then would
   * set it against stale content (and clear it before the real render lands).
   * When this is set, the effect waits until the DOM value is the inserted
   * text. Mention insertion leaves it null and behaves exactly as before.
   */
  const pendingValue = useRef<string | null>(null)
  const tokenKey = useRef<string | null>(null)
  // The token the visitor explicitly dismissed (Escape, or a pick). It is not
  // allowed to reopen until the token itself changes — otherwise the keyup
  // that follows the keydown re-reads the not-yet-re-rendered textarea and
  // pops the list straight back up.
  const closedToken = useRef<string | null>(null)
  const listId = useRef(`gt-mention-list-${++listSeq}`).current

  const matches = useMemo(
    () => (token ? filterCandidates(candidates, token.query) : []),
    [candidates, token]
  )
  const open = token !== null && matches.length > 0

  /*
   * Layout effect, not a passive one: the caret has to be placed in the same
   * commit that writes the new value. A deferred effect can run after the
   * browser (or jsdom) has already reset the selection to the end of the
   * controlled textarea, which loses the insertion point for the next paste or
   * image upload.
   */
  useLayoutEffect(() => {
    if (pendingCaret.current == null) return
    const caret = pendingCaret.current
    const el = ref.current
    if (!el) return
    // Wait for the render that actually carries the inserted text (see
    // `pendingValue`); an older commit must not consume the caret.
    if (pendingValue.current !== null && el.value !== pendingValue.current) return
    pendingCaret.current = null
    pendingValue.current = null
    el.focus()
    try {
      el.setSelectionRange(caret, caret)
    } catch {
      // Some browsers refuse setSelectionRange on a detached/hidden node.
    }
  })

  /**
   * Grow the editor with its content, up to the CSS `max-height`.
   *
   * The composer used to be a fixed 36px single-line bar; the merged
   * source/preview component lets a draft breathe instead of scrolling inside
   * one line. Measuring after the value render keeps the height in step with
   * controlled updates (typing, mention insertion, image Markdown) without a
   * second state variable. A hidden textarea reports 0 — the preview state —
   * and is left alone.
   */
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || el.scrollHeight <= 0) return
    // `height: auto` first: scrollHeight is clamped to the current box, so a
    // draft that shrank would otherwise never give the height back.
    el.style.height = 'auto'
    const content = el.scrollHeight
    const max = Number.parseFloat(getComputedStyle(el).maxHeight)
    const next = Number.isFinite(max) ? Math.min(content, max) : content
    el.style.height = `${next}px`
    el.style.overflowY = content > next ? 'auto' : 'hidden'
  })

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus])

  /** Close the popup without touching the draft. */
  const closeMenu = useCallback(() => {
    closedToken.current = tokenKey.current
    setToken(null)
  }, [])

  /** Re-read the caret and decide whether a mention token is open. */
  const sync = useCallback(() => {
    const el = ref.current
    if (!el) return
    const next = mentionQueryAt(el.value, el.selectionStart ?? el.value.length)
    const key = next ? `${next.start}:${next.query}` : null

    if (key === null) closedToken.current = null
    // Dismissed on purpose and unchanged since: stay closed.
    else if (key === closedToken.current) return
    else closedToken.current = null

    // The highlighted row only resets when the *token* changes: ArrowDown
    // fires keyup too, and resetting there would make the list unusable.
    if (key !== tokenKey.current) {
      tokenKey.current = key
      setActive(0)
    }
    setToken(next)
  }, [])

  const handleInput = (e: TargetedInputEvent<HTMLTextAreaElement>) => {
    onInput(e.currentTarget.value)
    sync()
  }

  const commit = useCallback(
    (candidate: MentionCandidate) => {
      const el = ref.current
      if (!el || !token) return
      const caret = el.selectionStart ?? el.value.length
      const next = insertMention(el.value, { start: token.start, caret }, candidate.login)
      pendingCaret.current = next.caret
      closeMenu()
      setActive(0)
      onInput(next.text)
    },
    [closeMenu, onInput, token]
  )

  /**
   * Insert externally generated text (image Markdown) at the caret.
   *
   * Reuses `pendingCaret`, so the controlled value re-render restores the
   * caret after the inserted text instead of jumping to the end. When the host
   * says the caret is unavailable — the floating preview hides the editor —
   * the text is appended instead.
   */
  const insertAtCaret = useCallback(
    (text: string) => {
      const el = ref.current
      const current = el?.value ?? value
      const start =
        caretAvailable && el ? (el.selectionStart ?? current.length) : current.length
      const end = caretAvailable && el ? (el.selectionEnd ?? start) : current.length
      const next = current.slice(0, start) + text + current.slice(end)
      pendingCaret.current = start + text.length
      pendingValue.current = next
      onInput(next)
    },
    [caretAvailable, onInput, value]
  )

  // Keep the host's handle pointed at the latest closure (latest `value`), and
  // clear it on unmount so a late upload result cannot write into a dead node.
  useEffect(() => {
    if (!handleRef) return
    handleRef.current = { insertAtCaret }
    return () => {
      handleRef.current = null
    }
  }, [handleRef, insertAtCaret])

  const handleKeyDown = (e: TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => (i + 1) % matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => (i - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        const candidate = matches[active] ?? matches[0]
        if (candidate && !(e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault()
          commit(candidate)
          return
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        // Only the popup closes: the draft stays.
        closeMenu()
        return
      }
    }

    if (e.key === 'Escape') {
      onEscape?.()
      return
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onSubmit?.()
      return
    }

    // Opt-in only: Enter is how a multi-line comment gets its next line.
    if (
      submitOnPlainEnter &&
      e.key === 'Enter' &&
      !e.shiftKey &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.isComposing
    ) {
      e.preventDefault()
      onSubmit?.()
    }
  }

  // Click outside closes the popup. `mousedown` rather than `click` so the
  // popup is gone before focus moves, and a capture-less listener is enough:
  // the rows themselves stop the event with their own handler.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.parentElement?.contains(e.target as Node)) closeMenu()
    }
    // Same reasoning as the reaction picker: capture the document so the
    // deferred cleanup cannot trip over a torn-down global.
    const doc = document
    doc.addEventListener('mousedown', onPointerDown)
    return () => doc.removeEventListener('mousedown', onPointerDown)
  }, [closeMenu, open])

  const pick = (e: TargetedMouseEvent<HTMLLIElement>, candidate: MentionCandidate) => {
    e.preventDefault()
    commit(candidate)
  }

  return (
    <div className="gt-editor">
      <textarea
        ref={ref}
        className={className}
        value={value}
        rows={rows}
        placeholder={placeholder}
        aria-label={ariaLabel}
        // Preact's intrinsic types narrow `role` on a textarea to "textbox",
        // but the listbox combobox pattern is exactly what this is.
        role={'combobox' as 'textbox'}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        aria-haspopup="listbox"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={sync}
        onClick={sync}
        onBlur={closeMenu}
      />

      {open ? (
        <ul className="gt-mention-list" id={listId} role="listbox" aria-label={listLabel}>
          {matches.map((candidate, index) => (
            <li
              key={candidate.login}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={`gt-mention-item${index === active ? ' is--active' : ''}`}
              // mousedown would blur the textarea before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={(e) => pick(e, candidate)}
            >
              <Avatar className="gt-mention-avatar" src={candidate.avatarUrl} alt={candidate.login} />
              <span className="gt-mention-login">{candidate.login}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
