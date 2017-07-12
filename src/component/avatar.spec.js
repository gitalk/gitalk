import React from 'react'
import { shallow } from 'enzyme'

import Avatar from './avatar'

describe('Avatar', function () {
  it('set props className', function () {
    const className = 'class'
    expect(shallow(<Avatar className={className} />)
      .hasClass(`gt-avatar ${className}`)
    ).toBe(true)
  })
  it('set props src', function () {
    const src = 'src'
    expect(shallow(<Avatar src={src} />)
      .find('img').prop('src')
    ).toEqual(src)
  })
})

