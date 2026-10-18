import { authorAriaLabel, authorTitle, displayNameOf, type NamedUser } from '../display-name'

interface AuthorNameProps {
  user: NamedUser
  /** Render as a link (a real profile) or as plain text (a pending row). */
  href?: string
  className?: string
  /** The surrounding widget is mirrored; only then does `dir` matter. */
  rtl?: boolean
}

/**
 * The author's name in a comment header.
 *
 * Prints the GitHub display name when the transport supplied one and the login
 * otherwise, so the row is never blank. When the two differ the login is kept
 * for assistive tech (`aria-label`) and for sighted visitors on hover
 * (`title`) — the visible label is always the nickname, as asked.
 */
export function AuthorName({
  user,
  href,
  className = 'gt-comment-username',
  rtl = false
}: AuthorNameProps) {
  const name = displayNameOf(user)
  const label = authorAriaLabel(user)
  const title = authorTitle(user)

  /**
   * A login is an ASCII identifier, not natural language: pinning it LTR keeps
   * `@octocat` from being reordered to `octocat@` under the widget's RTL
   * direction (and keeps the profile link's text laid out the way the handle is
   * typed). A display name *is* natural language, so it gets `auto`: a Persian
   * nickname stays RTL, a Latin one stays LTR. `dir` also isolates the run, so
   * neither can drag the adjacent date or badge out of place.
   *
   * Only emitted for an RTL widget. The ten LTR locales keep exactly the same
   * DOM they had before — no attribute, no direction hint, no visual change.
   */
  const dir = !rtl ? undefined : name === user.login ? 'ltr' : 'auto'

  if (href) {
    return (
      <a className={className} href={href} aria-label={label} title={title} dir={dir}>
        {name}
      </a>
    )
  }

  return (
    <span className={className} aria-label={label} title={title} dir={dir}>
      {name}
    </span>
  )
}
