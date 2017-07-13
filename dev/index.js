/**
 * config.js:
 *
 * window.CONFIG = {
 *   clientID: '',
 *   clientSecret: '',
 *   owner: '',
 *   repo: '',
 *   admin: []
 * }
 */
const gitalk = new Gitalk(window.CONFIG)

gitalk.render('gitalk-container')
