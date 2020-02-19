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
  it('set props alt', function () {
    const alt = 'alt'
    expect(shallow(<Avatar alt={alt} />)
      .find('img').prop('alt')
    ).toEqual(`@${alt}`)
  })
  it('set props onError', function () {
    const onError = 'onError'
    expect(shallow(<Avatar onError={onError} />)
      .find('img').prop('onError')
    ).toEqual(onError)
  })
})

