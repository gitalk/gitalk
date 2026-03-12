import moxios from 'moxios'

import getComments from './getComments'
import { axiosGithub } from '../util'

describe('graphql/getComments', function () {
  beforeEach(function () {
    moxios.install(axiosGithub)
  })

  afterEach(function () {
    moxios.uninstall(axiosGithub)
  })

  it('loads comments with last direction and prepends mapped items', function (done) {
    const ctx = {
      accessToken: 'token-last',
      options: {
        owner: 'gitalk',
        repo: 'repo',
        perPage: 10,
        pagerDirection: 'last',
        defaultAuthor: {
          avatarUrl: 'default-avatar',
          login: 'default-login',
          url: 'default-url'
        }
      },
      state: {
        cursor: null,
        comments: [{ id: 99, body: 'old comment' }]
      },
      setState (nextState) {
        this.state = Object.assign({}, this.state, nextState)
      }
    }

    const promise = getComments.call(ctx, { number: 7 })

    moxios.wait(function () {
      const request = moxios.requests.mostRecent()
      const payload = JSON.parse(request.config.data)

      expect(request.url).toBe('/graphql')
      expect(request.config.headers.Authorization).toBe('bearer token-last')
      expect(payload.query).toEqual(expect.stringContaining('comments(last: $pageSize, before: $cursor)'))
      expect(payload.variables.cursor).toBe(undefined)

      request.respondWith({
        status: 200,
        response: {
          data: {
            repository: {
              issue: {
                comments: {
                  nodes: [{
                    id: 'gid-1',
                    databaseId: 1,
                    author: null,
                    bodyHTML: '<p>new</p>',
                    body: 'new',
                    createdAt: '2020-01-01T00:00:00Z',
                    reactions: {
                      totalCount: 0,
                      viewerHasReacted: false,
                      pageInfo: {
                        hasNextPage: false
                      },
                      nodes: []
                    }
                  }],
                  pageInfo: {
                    hasPreviousPage: true,
                    startCursor: 'cursor-start'
                  },
                  totalCount: 1
                }
              }
            }
          }
        }
      })
    })

    promise.then(function (comments) {
      expect(comments).toHaveLength(2)
      expect(comments[0].id).toBe(1)
      expect(comments[0].user.login).toBe('default-login')
      expect(comments[1].id).toBe(99)
      expect(ctx.state.cursor).toBe('cursor-start')
      expect(ctx.state.isLoadOver).toBe(false)
      done()
    }).catch(done)
  })

  it('loads comments with first direction and appends mapped items', function (done) {
    const ctx = {
      accessToken: 'token-first',
      options: {
        owner: 'gitalk',
        repo: 'repo',
        perPage: 10,
        pagerDirection: 'first',
        defaultAuthor: {
          avatarUrl: 'default-avatar',
          login: 'default-login',
          url: 'default-url'
        }
      },
      state: {
        cursor: 'cursor-current',
        comments: [{ id: 100, body: 'older comment' }]
      },
      setState (nextState) {
        this.state = Object.assign({}, this.state, nextState)
      }
    }

    const promise = getComments.call(ctx, { number: 8 })

    moxios.wait(function () {
      const request = moxios.requests.mostRecent()
      const payload = JSON.parse(request.config.data)

      expect(payload.query).toEqual(expect.stringContaining('comments(first: $pageSize, after: $cursor)'))
      expect(payload.variables.cursor).toBe('cursor-current')

      request.respondWith({
        status: 200,
        response: {
          data: {
            repository: {
              issue: {
                comments: {
                  nodes: [{
                    id: 'gid-2',
                    databaseId: 2,
                    author: {
                      avatarUrl: 'author-avatar',
                      login: 'author-login',
                      url: 'author-url'
                    },
                    bodyHTML: '<p>first</p>',
                    body: 'first',
                    createdAt: '2020-01-02T00:00:00Z',
                    reactions: {
                      totalCount: 1,
                      viewerHasReacted: true,
                      pageInfo: {
                        hasNextPage: false
                      },
                      nodes: []
                    }
                  }],
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: 'cursor-end'
                  },
                  totalCount: 1
                }
              }
            }
          }
        }
      })
    })

    promise.then(function (comments) {
      expect(comments).toHaveLength(2)
      expect(comments[0].id).toBe(100)
      expect(comments[1].id).toBe(2)
      expect(comments[1].user.login).toBe('author-login')
      expect(ctx.state.cursor).toBe('cursor-end')
      expect(ctx.state.isLoadOver).toBe(true)
      done()
    }).catch(done)
  })
})
