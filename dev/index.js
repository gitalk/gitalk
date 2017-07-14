/**
 * config.js:
 *
 * window.GT_CONFIG = {
 *   clientID: '',
 *   clientSecret: '',
 *   owner: '',
 *   repo: '',
 *   admin: []
 * }
 */
const gitalk = new Gitalk(window.GT_CONFIG)

gitalk.render('gitalk-container')
