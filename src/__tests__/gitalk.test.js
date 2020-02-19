import React from 'react'
import { shallow } from 'enzyme'
import moxios from 'moxios'

import '../__mocks__/setup'
import Gitalk from '../gitalk'
import Comment from '../component/comment'
import { axiosGithub } from '../util'

describe('Gitalk', function () {
  beforeEach(function () {
    moxios.install(axiosGithub)
  })
  afterEach(function () {
    moxios.uninstall(axiosGithub)
  })
  it('render', function (done) {
    const props = {}
    const wrapper = shallow(<Gitalk {...props} />)
    expect(wrapper.find('.gt-container')).toHaveLength(1)

    moxios.wait(function () {
      wrapper.update()
      expect(wrapper.find(Comment)).toHaveLength(2)
      done()
    })
  })
})
