import React from 'react'
import { shallow } from 'enzyme'
import sinon from 'sinon'

import Action from './action'

describe('Action', function () {
  it('set props className', function () {
    const className = 'class'
    expect(shallow(<Action className={className} />)
      .hasClass(className)
    ).toBe(true)
  })
  it('set props text', function () {
    const text = 'text'
    expect(shallow(<Action text={text} />)
      .find('.gt-action-text').text()
    ).toEqual(text)
  })
  it('set props onClick', function () {
    const onButtonClick = sinon.spy()
    const wrapper = shallow(<Action onClick={onButtonClick} />)
    wrapper.find('a').simulate('click')
    expect(onButtonClick.calledOnce).toBe(true)
  })
})
