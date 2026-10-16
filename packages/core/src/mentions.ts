import type { GitalkComment, GitalkUser } from './types'

/**
 * `@`-mention autocomplete, as pure functions.
 *
 * The editor component owns focus and rendering; everything that can be
 * reasoned about without a DOM — "is the caret inside a mention token?", "who
 * can be mentioned?", "what does the text become?" — lives here so it can be
 * tested directly and shared by the composer and the inline reply box.
 */

export interface MentionCandidate {
  login: string
  avatarUrl: string
}

/** The mention token the caret currently sits in. */
export interface MentionQuery {
  /** Index of the `@` that opened the token. */
  start: number
  /** Text typed after the `@` (may be empty). */
  query: string
}

/** How many candidates the popup shows at once. */
export const MENTION_LIMIT = 6

/**
 * The active mention token before `caret`, or null when there is none.
 *
 * A token only counts when the `@` opens it at a word boundary — the start of
 * the text or right after whitespace — and nothing but identifier characters
 * has been typed since. That is what keeps `user@example.com` and a mid-word
 * `@` from opening the popup, and it is also what closes it as soon as the
 * visitor types a space.
 */
export function mentionQueryAt(text: string, caret: number): MentionQuery | null {
  const upto = text.slice(0, Math.max(0, Math.min(caret, text.length)))
  const at = upto.lastIndexOf('@')
  if (at < 0) return null

  // Start of text, or after whitespace. (`$` cannot open one: there is no
  // character before it to check, and index 0 is handled here.)
  const before = at > 0 ? upto[at - 1]! : ''
  if (before && !/\s/.test(before)) return null

  const query = upto.slice(at + 1)
  // A second `@` or any whitespace ends the token instead of extending it.
  if (/[\s@]/.test(query)) return null

  return { start: at, query }
}

/**
 * Everyone who has written in the loaded thread, de-duplicated by login and
 * ordered the way they appear on screen (so the newest speaker is first).
 *
 * `exclude` drops one login — the viewer's own, so the popup does not offer to
 * mention yourself.
 */
export function collectParticipants(
  comments: GitalkComment[],
  exclude?: string | null
): MentionCandidate[] {
  const skip = exclude?.toLowerCase()
  const seen = new Set<string>()
  const out: MentionCandidate[] = []

  const consider = (user: GitalkUser) => {
    const login = user?.login
    if (!login || login === 'ghost') return
    const key = login.toLowerCase()
    if (key === skip || seen.has(key)) return
    seen.add(key)
    out.push({ login, avatarUrl: user.avatarUrl })
  }

  for (const comment of comments) {
    consider(comment.user)
    for (const reply of comment.replies ?? []) consider(reply.user)
  }

  return out
}

/**
 * Candidates matching the typed prefix.
 *
 * Prefix first, then substring, each alphabetical: typing `a` should offer
 * `alice` before `bob` even if `bob` wrote first, but `alice` should still
 * come before `alicia-unknown` for `ali`.
 */
export function filterCandidates(
  candidates: MentionCandidate[],
  query: string,
  limit: number = MENTION_LIMIT
): MentionCandidate[] {
  const needle = query.toLowerCase()
  const ranked: Array<{ candidate: MentionCandidate; rank: number }> = []

  for (const candidate of candidates) {
    const login = candidate.login.toLowerCase()
    const rank = needle === '' ? 1 : login.startsWith(needle) ? 0 : login.includes(needle) ? 2 : 3
    if (rank === 3) continue
    ranked.push({ candidate, rank })
  }

  ranked.sort(
    (a, b) => a.rank - b.rank || a.candidate.login.localeCompare(b.candidate.login)
  )
  return ranked.slice(0, limit).map((entry) => entry.candidate)
}

/**
 * Replace the token with `@login `.
 *
 * `caret` (not `range.start` + query length) is what gets replaced, because
 * the visitor may have moved the cursor after the popup opened; whatever sits
 * between the `@` and the caret is the token they were filtering.
 *
 * Returns the new text and where the caret has to land, so the caller can put
 * it back after the controlled value re-renders.
 */
export function insertMention(
  text: string,
  range: { start: number; caret: number },
  login: string
): { text: string; caret: number } {
  const start = Math.max(0, Math.min(range.start, text.length))
  const caret = Math.max(start, Math.min(range.caret, text.length))
  const inserted = `@${login} `
  return {
    text: `${text.slice(0, start)}${inserted}${text.slice(caret)}`,
    caret: start + inserted.length
  }
}
