/**
 * config.js:
 *
 * window.GT_CONFIG = {
 *   clientID: '',
 *   clientSecret: '',
 *   owner: '',
 *   repo: '',
 *   admin: [],
 *   distractionFreeMode: false,
 *   pagerDirection: 'last'
 * }
 */
const gitalk = new Gitalk(window.GT_CONFIG, 'dark')

gitalk.render('gitalk-container')
