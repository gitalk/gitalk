import React from 'react'
import { shallow } from 'enzyme'

import Svg from './svg'

describe('Svg', function () {
  it('set props className', function () {
    const className = 'class'
    expect(shallow(<Svg className={className} />)
      .hasClass(`gt-ico ${className}`)
    ).toBe(true)
  })
  it('set props text', function () {
    const text = 'text'
    expect(shallow(<Svg text={text} />)
      .find('.gt-ico-text').text()
    ).toEqual(text)
  })
})
