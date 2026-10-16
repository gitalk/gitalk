import React from 'react'
import { shallow } from 'enzyme'
import moxios from 'moxios'
import sinon from 'sinon'

import '../__mocks__/setup'
import Gitalk from '../gitalk'
import { axiosGithub } from '../util'

// The v3 (REST) API has no sort parameter, so `getCommentsV3OrderDesc` walks
// the pages backwards to serve `pagerDirection: 'last'` (newest first).
describe('getCommentsV3OrderDesc', function () {
  let get

  beforeEach(function () {
    moxios.install(axiosGithub)
  })

  afterEach(function () {
    if (get) {
      get.restore()
      get = null
    }
    moxios.uninstall(axiosGithub)
  })

  it('returns the newest comments first, without gaps or duplicates', function () {
    const all = [1, 2, 3, 4, 5]
    const issue = {
      comments: all.length,
      comments_url: 'https://api.github.com/repos/xxx/xxx/issues/1/comments'
    }
    const wrapper = shallow(<Gitalk options={{
      clientID: 'client-id',
      clientSecret: 'client-secret',
      perPage: 2,
      pagerDirection: 'last'
    }} />)
    const instance = wrapper.instance()

    // Serve `all` the way the real API would: ascending, page by page.
    get = sinon.stub(axiosGithub, 'get').callsFake((url, config) => {
      const { page, per_page: perPage } = config.params
      const start = (page - 1) * perPage
      return Promise.resolve({ data: all.slice(start, start + perPage) })
    })

    instance.state.issue = issue

    return instance.getCommentsV3OrderDesc(issue)
      .then(comments => {
        expect(comments).toEqual([5, 4])
        return instance.getCommentsV3OrderDesc(issue)
      })
      .then(comments => {
        expect(comments).toEqual([5, 4, 3, 2])
        return instance.getCommentsV3OrderDesc(issue)
      })
      .then(comments => {
        expect(comments).toEqual([5, 4, 3, 2, 1])
        expect(instance.state.isLoadOver).toBe(true)
      })
  })
})
