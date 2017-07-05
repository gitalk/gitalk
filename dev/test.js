/**
 * config.js:
 *
 * window.CONFIG = {
 *   parent: 'root',
 *   clientID: '',
 *   clientSecret: '',
 *   owner: '',
 *   repo: '',
 *   admin: []
 * }
 */
const gitalk = new Gitalk(window.CONFIG)

gitalk.render()
