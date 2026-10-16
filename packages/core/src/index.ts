import './styles/index.css'
export { GitalkWidget } from './widget'
export { useGitalk } from './use-gitalk'
export { mount } from './mount'
export type { MountResult } from './mount'
export { VERSION } from './version'
export { default as Gitalk } from './standalone'
export { createTranslator, locales } from './i18n'
export { formatRelativeTime } from './time'
export type {
  Backend as BackendInterface,
  BackendContext,
  ReactionTarget
} from './api/backend'
export type {
  BackendKind,
  GitalkComment,
  GitalkOptions,
  GitalkReply,
  GitalkUser,
  Reaction,
  SortDirection,
  ThreadInfo,
  ThreadPage
} from './types'
export { GitalkError, RateLimitError } from './api/client'
