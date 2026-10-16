import React from 'react'
import { shallow } from 'enzyme'
import moxios from 'moxios'

import '../__mocks__/setup'
import Gitalk from '../gitalk'
import Comment from '../component/comment'
import { axiosGithub } from '../util'

describe('Gitalk', function () {
  // `moxios.uninstall()` resets the stubs registered in `__mocks__/setup.js`,
  // so install/uninstall once for the whole file instead of per test.
  beforeAll(function () {
    moxios.install(axiosGithub)
  })
  afterAll(function () {
    moxios.uninstall(axiosGithub)
  })
  it('render', function (done) {
    const props = {}
    const wrapper = shallow(<Gitalk {...props} />)
    expect(wrapper.find('.gt-container')).toHaveLength(1)
    expect(wrapper.find('.gt-light')).toHaveLength(1)
    expect(wrapper.find('.gt-dark')).toHaveLength(0)

    moxios.wait(function () {
      wrapper.update()
      expect(wrapper.find(Comment)).toHaveLength(2)
      done()
    })
  })
  it('render-dark-theme', function () {
    const wrapper = shallow(<Gitalk theme="dark"/>)
    expect(wrapper.find('.gt-light')).toHaveLength(0)
    expect(wrapper.find('.gt-dark')).toHaveLength(1)
  })
  it('render-dark-theme-from-options', function () {
    const wrapper = shallow(<Gitalk options={{ theme: 'dark' }}/>)
    expect(wrapper.find('.gt-light')).toHaveLength(0)
    expect(wrapper.find('.gt-dark')).toHaveLength(1)
  })
  it('label the comment textarea for screen readers', function () {
    const wrapper = shallow(<Gitalk />)
    wrapper.instance().setState({ isIniting: false })
    wrapper.update()

    const label = wrapper.find('label.gt-header-label')
    expect(label).toHaveLength(1)
    expect(label.prop('htmlFor')).toEqual('gt-header-textarea')
    expect(label.text()).toEqual('Leave a comment')
    expect(wrapper.find('textarea.gt-header-textarea').prop('id')).toEqual('gt-header-textarea')
  })
})
