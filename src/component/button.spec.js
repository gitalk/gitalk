import React from 'react'
import { shallow } from 'enzyme'
import sinon from 'sinon'

import Button from './button'

describe('Button', function () {
  it('set props className', function () {
    const className = 'class'
    expect(shallow(<Button className={className} />)
      .hasClass(className)
    ).toBe(true)
  })
  it('set props text', function () {
    const text = 'text'
    expect(shallow(<Button text={text} />)
      .find('.gt-btn-text').text()
    ).toEqual(text)
  })
  it('set props isLoading', function () {
    expect(shallow(<Button isLoading={true} />)
      .find('.gt-btn-loading').exists()
    ).toBe(true)
  })
  it('set props onClick', function () {
    const onButtonClick = sinon.spy()
    const wrapper = shallow(<Button onClick={onButtonClick} />)
    wrapper.find('button').simulate('click')
    expect(onButtonClick.calledOnce).toBe(true)
  })
})
