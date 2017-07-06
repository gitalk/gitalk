import React, { Component } from 'react'
import axios from 'axios'
import i18n from './i18n'
import './style/index.css'
import { queryParse, queryStringify, axiosJSON, axiosGithub } from './util'
import Avatar from './component/avatar'
import Button from './component/button'
import Comment from './component/comment'
import { GT_ACCESS_TOKEN, GT_USER_INFO } from './const'

class GitalkComponent extends Component {
  state = {
    user: null,
    issue: null,
    comments: [],
    localComments: [],
    comment: '',
    page: 1,

    isNoInit: false,
    isIniting: true,
    isCreating: false,
    isLoading: false,
    isLoadMore: false,
    isLoadOver: false,
    isIssueCreating: false,

    isOccurError: false,
    errorMsg: ''
  }
  constructor (props) {
    super(props)
    this.options = Object.assign({}, {
      perPage: 30,
      url: location.href,
      title: document.title,
      body: '',
      id: location.href,
      labels: ['Gitalk'],
      proxy: 'https://cors-anywhere.herokuapp.com/https://github.com/login/oauth/access_token',
      language: navigator.language || navigator.userLanguage,
    }, props.options)

    try {
      this.state.user = JSON.parse(localStorage.getItem(GT_USER_INFO))
    } catch (err) {
      localStorage.removeItem(GT_USER_INFO)
    }

    // 处理 github 授权登录返回的 code
    const query = queryParse()
    if (query.code) {
      const code = query.code
      delete query.code
      const replacedUrl = `${location.origin}${location.pathname}${queryStringify(query)}${location.hash}`
      history.replaceState(null, null, replacedUrl)
      this.options = Object.assign({}, this.options, {
        url: replacedUrl,
        id: replacedUrl
      }, props.options)

      axiosJSON.post(this.options.proxy, {
        code,
        client_id: this.options.clientID,
        client_secret: this.options.clientSecret
      }).then(res => {
        if (res.data && res.data.access_token) {
          this.accessToken = res.data.access_token

          this.getInit()
            .then(() => this.setState({ isIniting: false }))
            .catch(err => {
              console.log('err:', err)
            })
        } else {
          // no access_token
          console.log('res.data err:', res.data)
          this.setState({
            isOccurError: true,
            errorMsg: this.formatErrorMsg(new Error('no access token'))
          })
        }
      }).catch(err => {
        console.log('err: ', err)
        this.setState({
          isOccurError: true,
          errorMsg: this.formatErrorMsg(err)
        })
      })
    } else {
      this.getInit()
        .then(() => this.setState({ isIniting: false }))
        .catch(err => {
          console.log('err:', err)
          this.setState({
            isIniting: false,
            isOccurError: true,
            errorMsg: this.formatErrorMsg(err)
          })
        })
    }

    this.i18n = i18n(this.options.language)
  }

  get accessToken () {
    return this._accessToke || localStorage.getItem(GT_ACCESS_TOKEN)
  }
  set accessToken (token) {
    localStorage.setItem(GT_ACCESS_TOKEN, token)
    this._accessToken = token
  }

  get loginLink () {
    const githubOauthUrl = 'http://github.com/login/oauth/authorize'
    const { clientID } = this.options
    const query = {
      client_id: clientID,
      redirect_uri: location.href,
      scope: 'public_repo'
    }
    return `${githubOauthUrl}?${queryStringify(query)}`
  }

  formatErrorMsg (err) {
    let msg = 'Error: '
    if (err.response && err.response.data && err.response.data.message) {
      msg += `${err.response.data.message}. `
      err.response.data.errors && (msg += err.response.data.errors.map(e => e.message).join(', '))
    } else {
      msg += err.message
    }
    return msg
  }

  getInit () {
    return this.getUserInfo().then(() => this.getComments())
  }
  getUserInfo () {
    return axiosGithub.get('/user', {
      headers: {
        Authorization: `token ${this.accessToken}`
      }
    }).then(res => {
      this.setState({ user: res.data })
      localStorage.setItem(GT_USER_INFO, JSON.stringify(res.data))
    }).catch(err => {
      this.setState({ user: null })
      localStorage.removeItem(GT_USER_INFO)
      localStorage.removeItem(GT_ACCESS_TOKEN)
    })
  }
  getIssue () {
    const { issue } = this.state
    if (issue) {
      this.setState({ isNoInit: false })
      return Promise.resolve(issue)
    }

    const { owner, repo, id, labels, clientID, clientSecret, admin } = this.options

    const requests = [].concat(admin).map(name => axiosGithub.get(`/repos/${owner}/${repo}/issues`, {
      params: {
        client_id: clientID,
        client_secret: clientSecret,
        creator: name,
        labels: labels.concat(id).join(',')
      }
    }))

    return axios.all(requests).then(responses => {
      const res = responses.filter(res => res.data && res.data.length)[0] || {}
      let isNoInit = false
      let issue = null
      if (!(res && res.data && res.data.length)) {
        isNoInit = true
      } else {
        issue = res.data[0]
      }
      this.setState({ issue, isNoInit })
      return issue
    })
  }
  createIssue () {
    const { owner, repo, title, body, id, labels } = this.options
    return axiosGithub.post(`/repos/${owner}/${repo}/issues`, {
      title,
      labels: labels.concat(id),
      body
    }, {
      headers: {
        Authorization: `token ${this.accessToken}`
      }
    }).then(res => {
      this.setState({ issue: res.data })
      return res.data
    })
  }
  getComments = () => {
    const { clientID, clientSecret, perPage } = this.options
    const { page } = this.state
    return this.getIssue()
      .then(issue => {
        if (!issue) return

        return axiosGithub.get(issue.comments_url, {
          params: {
            client_id: clientID,
            client_secret: clientSecret,
            per_page: perPage,
            page
          }
        }).then(res => {
          const { comments, issue } = this.state
          let isLoadOver = false
          const cs = comments.concat(res.data)
          if (cs.length >= issue.comments || res.data.length < perPage) {
            isLoadOver = true
          }
          this.setState({
            comments: cs,
            isLoadOver,
            page: page + 1
          })
          return cs
        })
      })
  }
  createComment () {
    const { comment, localComments } = this.state

    return this.getIssue()
      .then(issue => axiosGithub.post(issue.comments_url, {
        body: comment
      }, {
        headers: {
          Authorization: `token ${this.accessToken}`
        }
      }))
      .then(res => {
        this.setState({ comment: '', localComments: localComments.concat(res.data) })
      })
  }


  handleLogin = () => {
    location.href = this.loginLink
  }
  handleIssueCreate = () => {
    this.setState({ isIssueCreating: true })
    this.createIssue().then(() => {
      this.setState({
        isIssueCreating: false,
        isOccurError: false
      })
      return this.getComments()
    }).catch(err => {
      this.setState({
        isIssueCreating: false,
        isOccurError: true,
        errorMsg: this.formatErrorMsg(err)
      })
    })
  }
  handleCommentCreate = () => {
    if (!this.state.comment.length) {
      this.commentEL.focus()
      return
    }
    this.setState({ isCreating: true })
    this.createComment()
      .then(() => this.setState({
        isCreating: false,
        isOccurError: false
      }))
      .catch(err => {
        this.setState({
          isCreating: false,
          isOccurError: true,
          errorMsg: this.formatErrorMsg(err)
        })
      })
  }
  handleCommentLoad = () => {
    if (this.state.isLoadMore) return
    this.setState({ isLoadMore: true })
    this.getComments().then(() => this.setState({ isLoadMore: false }))
  }
  handleCommentChange = e => this.setState({ comment: e.target.value })


  initing () {
    return <div className="gt-initing">
      <span className="gt-inting-spinner gt-spinner" />
      <p className="gt-inting-text">{this.i18n.t('init')}</p>
    </div>
  }
  noInit () {
    const { user, isIssueCreating } = this.state
    const { owner, repo, admin } = this.options
    return (
      <div className="gt-no-init" key="no-init">
        <p dangerouslySetInnerHTML={{
          __html: this.i18n.t('no-found-related', {
            link: `<a href="https://github.com/${owner}/${repo}/issues">Issues</a>`
          })
        }}/>
        <p>{this.i18n.t('please-contact', { user: [].concat(admin).map(u => `@${u}`).join(' ') })}</p>
        {(user && ~[].concat(admin).indexOf(user.login)) && <p>
          <Button onClick={this.handleIssueCreate} isLoading={isIssueCreating} text={this.i18n.t('init-issue')} />
        </p>}
      </div>
    )
  }
  header () {
    const { user, comment, isCreating } = this.state
    return (
      <div className="gt-header" key="header">
        {user ?
          <Avatar className="gt-header-avatar" src={user.avatar_url} /> :
          <a href={this.loginLink} className="gt-header-github" />
        }
        <div className="gt-header-comment">
          <textarea
            ref={t => { this.commentEL = t }}
            className="gt-header-textarea"
            value={comment}
            onChange={this.handleCommentChange}
            placeholder={this.i18n.t('leave-a-comment')}
          />
          <div className="gt-header-controls">
            {user ?
              <Button className="gt-btn-public" onClick={this.handleCommentCreate} text={this.i18n.t('comment')} isLoading={isCreating} /> :
              <Button className="gt-btn-login" onClick={this.handleLogin} text={this.i18n.t('login-with-github')} />
            }
          </div>
        </div>
      </div>
    )
  }
  comments () {
    const { user, comments, localComments, isLoadOver, isLoadMore } = this.state
    const { language } = this.options
    return (
      <div className="gt-comments" key="comments">
        {comments.concat(localComments).map(c => (
          <Comment comment={c} key={c.id} user={user} language={language}/>
        ))}
        {!comments.concat(localComments).length && <p className="gt-comments-null">{this.i18n.t('first-comment-person')}</p>}
        {!isLoadOver && <div className="gt-comments-controls">
          <Button onClick={this.handleCommentLoad} isLoading={isLoadMore} text={this.i18n.t('load-more')} />
        </div>}
      </div>
    )
  }
  footer () {
    return (
      <div className="gt-footer" key="footer" dangerouslySetInnerHTML={{
        __html: this.i18n.t('footer', {
          link: '<a class="gt-footer-link" href="https://github.com/gitalk/gitalk">Gitalk</a>'
        })
      }}/>
    )
  }

  render () {
    const { isIniting, isNoInit, isOccurError, errorMsg } = this.state
    return (
      <div className="gt-container">
        {isOccurError && <div className="gt-error">
          {errorMsg}
        </div>}
        {isIniting && this.initing()}
        {!isIniting && (
          isNoInit ? [
            this.noInit()
          ] : [
            this.header(),
            this.comments(),
            this.footer()
          ])
        }
      </div>
    )
  }
}

module.exports = GitalkComponent
