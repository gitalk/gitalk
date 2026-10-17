/**
 * Build-time constants injected through vite's `define`.
 *
 * `__GITALK_STARS__` is filled by the deploy workflow and is empty when the
 * page is built locally, so consumers must treat the empty string as "unknown"
 * rather than rendering it.
 */
declare const __GITALK_VERSION__: string
declare const __GITALK_STARS__: string
