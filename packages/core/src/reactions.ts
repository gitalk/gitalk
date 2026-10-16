import type { GitalkReactions, Reaction } from './types'
import { REACTIONS } from './types'

/**
 * The eight GitHub reaction types, the way GitHub's own picker shows them.
 *
 * Names stay English (they are what GitHub's API and UI use, and what a screen
 * reader will announce next to an emoji); the emoji is the visible affordance.
 */
export const REACTION_EMOJI: Record<Reaction, string> = {
  THUMBS_UP: '👍',
  THUMBS_DOWN: '👎',
  LAUGH: '😄',
  HOORAY: '🎉',
  CONFUSED: '😕',
  HEART: '❤️',
  ROCKET: '🚀',
  EYES: '👀'
}

/** Accessible name for each type, used as the button's `title`/`aria-label`. */
export const REACTION_LABEL: Record<Reaction, string> = {
  THUMBS_UP: 'Thumbs up',
  THUMBS_DOWN: 'Thumbs down',
  LAUGH: 'Laugh',
  HOORAY: 'Hooray',
  CONFUSED: 'Confused',
  HEART: 'Heart',
  ROCKET: 'Rocket',
  EYES: 'Eyes'
}

export interface ReactionChip {
  content: Reaction
  count: number
  /** The signed-in viewer holds this one. */
  mine: boolean
}

/**
 * The reactions worth showing as chips: everything with a count, plus anything
 * the viewer picked (a count of 0 only happens transiently, but the chip must
 * not flicker away while the mutation is in flight).
 */
export function reactionChips(reactions: GitalkReactions | undefined): ReactionChip[] {
  if (!reactions) return []
  const counts = reactions.counts ?? {}
  const mine = reactions.viewerReactions ?? {}

  return REACTIONS.filter((content) => (counts[content] ?? 0) > 0 || mine[content]).map(
    (content) => ({
      content,
      count: counts[content] ?? 0,
      mine: Boolean(mine[content])
    })
  )
}
