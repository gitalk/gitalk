// Injected at build time by Vite's define option; falls back for tests.
export const VERSION: string =
  typeof __GITALK_VERSION__ !== 'undefined' ? __GITALK_VERSION__ : '2.0.0-dev'
