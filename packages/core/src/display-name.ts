import type { GitalkUser } from './types'

/** The fields a rendered author name needs. */
export type NamedUser = Pick<GitalkUser, 'login' | 'displayName'>

/**
 * What to print for an author: the GitHub profile name when there is one,
 * otherwise the login.
 *
 * The fallback is the whole point of this helper. `displayName` is GraphQL-only
 * and nullable — plenty of accounts never set one — so every render path goes
 * through here rather than touching `displayName` directly, which is what keeps
 * a missing nickname from turning into an empty username.
 */
export function displayNameOf(user: NamedUser): string {
  const name = user.displayName?.trim()
  return name ? name : user.login
}

/**
 * Accessible label for an author whose nickname differs from the login.
 *
 * Screen readers announce the visible nickname and would otherwise lose the
 * `@login` entirely. Returns `undefined` when the visible text already *is* the
 * login, so the fallback case does not gain a redundant label.
 */
export function authorAriaLabel(user: NamedUser): string | undefined {
  const name = displayNameOf(user)
  return name === user.login ? undefined : `${name} (@${user.login})`
}

/**
 * Tooltip for an author whose nickname differs from the login.
 *
 * Gives sighted visitors the handle they need to find the account (or to type
 * an `@` mention), without printing it next to every nickname.
 */
export function authorTitle(user: NamedUser): string | undefined {
  return displayNameOf(user) === user.login ? undefined : `@${user.login}`
}
