import { authorAriaLabel, authorTitle, displayNameOf, type NamedUser } from '../display-name'

interface AuthorNameProps {
  user: NamedUser
  /** Render as a link (a real profile) or as plain text (a pending row). */
  href?: string
  className?: string
}

/**
 * The author's name in a comment header.
 *
 * Prints the GitHub display name when the transport supplied one and the login
 * otherwise, so the row is never blank. When the two differ the login is kept
 * for assistive tech (`aria-label`) and for sighted visitors on hover
 * (`title`) — the visible label is always the nickname, as asked.
 */
export function AuthorName({ user, href, className = 'gt-comment-username' }: AuthorNameProps) {
  const name = displayNameOf(user)
  const label = authorAriaLabel(user)
  const title = authorTitle(user)

  if (href) {
    return (
      <a className={className} href={href} aria-label={label} title={title}>
        {name}
      </a>
    )
  }

  return (
    <span className={className} aria-label={label} title={title}>
      {name}
    </span>
  )
}
