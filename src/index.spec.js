jest.mock('react-dom', function () {
  return {
    render: jest.fn(function () {
      return 'rendered-result'
    })
  }
})

import { render as reactDOMRender } from 'react-dom'
import Gitalk from './index'

describe('index', function () {
  beforeEach(function () {
    reactDOMRender.mockClear()
    document.body.innerHTML = ''
  })

  it('throws when container is required but missing', function () {
    const gitalk = new Gitalk({})
    expect(function () {
      gitalk.render()
    }).toThrow('Container is required')
  })

  it('throws when container id is not found', function () {
    const gitalk = new Gitalk({})
    expect(function () {
      gitalk.render('missing-id')
    }).toThrow('Container not found')
  })

  it('renders into container id and returns render result', function () {
    document.body.innerHTML = '<div id="gitalk-container"></div>'
    const options = { repo: 'gitalk-repo' }
    const gitalk = new Gitalk(options)

    const result = gitalk.render('gitalk-container')
    const args = reactDOMRender.mock.calls[0]

    expect(result).toBe('rendered-result')
    expect(reactDOMRender).toHaveBeenCalledTimes(1)
    expect(args[1].id).toBe('gitalk-container')
    expect(args[0].props.options).toEqual(options)
    expect(typeof args[2]).toBe('function')
  })

  it('renders into HTMLElement from options.container with callback', function () {
    const container = document.createElement('div')
    const callback = jest.fn()
    const options = {
      repo: 'gitalk-repo',
      container
    }
    const gitalk = new Gitalk(options)

    gitalk.render(undefined, callback)
    const args = reactDOMRender.mock.calls[0]

    expect(args[1]).toBe(container)
    expect(args[2]).toBe(callback)
  })
})
