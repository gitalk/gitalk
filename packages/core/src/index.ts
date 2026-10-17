import './styles/index.css'
export { GitalkWidget } from './widget'
export { useGitalk } from './use-gitalk'
export { mount } from './mount'
export type { MountResult } from './mount'
export { VERSION } from './version'
export { default as Gitalk } from './standalone'
export { createTranslator, locales } from './i18n'
export type { Messages, Translator } from './i18n'
export { formatRelativeTime } from './time'
export { REACTIONS } from './types'
export { REACTION_EMOJI, REACTION_LABEL, reactionChips } from './reactions'
export type { ReactionChip } from './reactions'
export {
  MENTION_LIMIT,
  collectParticipants,
  filterCandidates,
  insertMention,
  mentionQueryAt
} from './mentions'
export type { MentionCandidate, MentionQuery } from './mentions'
export type { LoginReason } from './use-gitalk'
export type {
  Backend as BackendInterface,
  BackendContext,
  ReactionTarget
} from './api/backend'
export type {
  BackendKind,
  FabPosition,
  GitalkComment,
  GitalkOptions,
  GitalkReactions,
  GitalkReply,
  GitalkUser,
  PendingComment,
  Reaction,
  ReactionCounts,
  ReactionFlags,
  SortDirection,
  ThreadInfo,
  ThreadPage,
  UpvoteState
} from './types'
export { GitalkError, RateLimitError } from './api/client'
