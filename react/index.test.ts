// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, waitFor } from '@testing-library/react'
import GitalkComponent from './index'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => [] })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('gitalk/react', () => {
  it('mounts the gitalk widget inside a react tree and cleans up on unmount', async () => {
    const { container, unmount } = render(
      createElement(GitalkComponent, {
        options: { clientID: 'i', clientSecret: 's', owner: 'o', repo: 'r', admin: 'o' },
      })
    )

    expect(container.querySelector('.gitalk-container')).toBeTruthy()
    await waitFor(() => {
      expect(container.querySelector('.gt-container')).toBeTruthy()
    })
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())

    unmount()
    expect(document.querySelector('.gt-container')).toBeFalsy()
  })

  it('applies custom className', async () => {
    const { container } = render(
      createElement(GitalkComponent, {
        options: { clientID: 'i', clientSecret: 's', owner: 'o', repo: 'r', admin: 'o' },
        className: 'my-comments',
      })
    )
    expect(container.querySelector('.my-comments')).toBeTruthy()
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled())
  })
})
