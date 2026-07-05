import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Gitalk from './index'

const baseOptions = { clientID: 'i', clientSecret: 's', owner: 'o', repo: 'r', admin: 'o' }

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Gitalk', () => {
  it('throws when container missing', () => {
    expect(() => new Gitalk(baseOptions).render()).toThrow('Container is required')
  })

  it('throws when container id not found', () => {
    expect(() => new Gitalk(baseOptions).render('not-exist')).toThrow('Container not found')
  })

  // 等初始化 effect 的首个请求打到 stub 上，避免测试结束后泄漏真实网络请求
  const waitForInitRequest = () => vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())

  it('renders into container resolved by id', async () => {
    const el = document.createElement('div')
    el.id = 'gitalk-container'
    document.body.appendChild(el)

    new Gitalk(baseOptions).render('gitalk-container')
    expect(el.querySelector('.gt-container')).toBeTruthy()
    await waitForInitRequest()
  })

  it('renders into an HTMLElement and supports options.container', async () => {
    const el = document.createElement('div')
    document.body.appendChild(el)

    new Gitalk({ ...baseOptions, container: el }).render()
    expect(el.querySelector('.gt-container')).toBeTruthy()
    await waitForInitRequest()
  })

  it('invokes render callback and supports destroy', async () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const callback = vi.fn()

    const gitalk = new Gitalk(baseOptions).render(el, callback)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(el.querySelector('.gt-container')).toBeTruthy()
    await waitForInitRequest()

    gitalk.destroy()
    expect(el.querySelector('.gt-container')).toBeFalsy()
  })
})
