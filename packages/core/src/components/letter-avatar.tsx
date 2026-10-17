/**
 * Initial avatar, the way the comment-ui reference draws people.
 *
 * The reference never shows the GitHub profile picture: every comment carries a
 * 34px circle with the first letter of the author on a saturated background,
 * and the colour is stable per person so a thread reads as a set of
 * personalities rather than a wall of identical grey icons.
 *
 * The palette is the brand hue and its neighbours (blue → indigo → violet →
 * sky). There is deliberately no green: #1E4FFF is the only accent family the
 * widget is allowed to use.
 */

const PALETTE = [
  '#1e4fff',
  '#2563eb',
  '#4f46e5',
  '#6366f1',
  '#0369a1',
  '#4338ca',
  '#7c3aed',
  '#075985'
] as const

/** FNV-1a, so the same login always lands on the same colour. */
function hashLogin(login: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < login.length; i++) {
    hash ^= login.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function avatarColor(login: string): string {
  return PALETTE[hashLogin(login.toLowerCase()) % PALETTE.length]!
}

export function avatarInitial(login: string): string {
  const first = Array.from(login.trim())[0] ?? '?'
  return first.toUpperCase()
}

interface LetterAvatarProps {
  /** GitHub login; the initial and the colour are derived from it. */
  login: string
  className?: string
}

export function LetterAvatar({ login, className }: LetterAvatarProps) {
  const color = avatarColor(login)

  return (
    <span
      className={`gt-avatar gt-avatar-letter${className ? ` ${className}` : ''}`}
      style={{
        backgroundColor: color,
        boxShadow: `0 0 0 1px rgba(255, 255, 255, 0.14) inset, 0 4px 16px -4px ${color}`
      }}
      // The author's name is printed immediately next to it; announcing the
      // initial as well would only repeat it.
      aria-hidden="true"
      title={`@${login}`}
    >
      {avatarInitial(login)}
    </span>
  )
}
