import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/preact'
import GitalkComponent from './Gitalk'

const mockFetch = vi.fn()

const jsonResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => data,
  text: async () => JSON.stringify(data),
})

const issueFixture = {
  number: 1,
  title: 'test issue',
  body: '',
  html_url: 'https://github.com/o/r/issues/1',
  comments: 2,
  comments_url: 'https://api.github.com/repos/o/r/issues/1/comments',
  labels: [{ name: 'Gitalk' }],
}

const commentFixture = (id: number) => ({
  id,
  user: {
    login: `user-${id}`,
    avatar_url: `https://avatars.example.com/${id}`,
    html_url: `https://github.com/user-${id}`,
  },
  created_at: '2020-01-01T00:00:00Z',
  body_html: `<p>comment ${id}</p>`,
  body: `comment ${id}`,
  html_url: `https://github.com/o/r/issues/1#issuecomment-${id}`,
})

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('GitalkComponent', () => {
  it('renders comments of the matched issue for anonymous visitors', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('/repos/o/r/issues?') || url.includes('labels=')) {
        return jsonResponse([issueFixture])
      }
      if (url.includes('/issues/1/comments')) {
        return jsonResponse([commentFixture(1), commentFixture(2)])
      }
      throw new Error(`unexpected fetch: ${url}`)
    })

    const { container } = render(
      <GitalkComponent
        options={{ clientID: 'i', clientSecret: 's', owner: 'o', repo: 'r', admin: 'o' }}
      />
    )

    expect(container.querySelector('.gt-container')).toBeTruthy()
    expect(container.querySelector('.gt-initing')).toBeTruthy()

    await waitFor(() => {
      expect(container.querySelectorAll('.gt-comment')).toHaveLength(2)
    })
    // 评论计数 = issue.comments
    expect(container.querySelector('.gt-link-counts')?.textContent).toBe('2')
    // 未登录仅展示登录按钮，无发布按钮
    expect(container.querySelector('.gt-btn-login')).toBeTruthy()
    expect(container.querySelector('.gt-btn-public')).toBeFalsy()
  })

  it('shows no-init hint when issue not found and user is not admin', async () => {
    mockFetch.mockImplementation(async () => jsonResponse([]))

    const { container } = render(
      <GitalkComponent
        options={{
          clientID: 'i',
          clientSecret: 's',
          owner: 'o',
          repo: 'r',
          admin: 'o',
          createIssueManually: true,
        }}
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.gt-no-init')).toBeTruthy()
    })
    expect(container.textContent).toContain('@o')
  })

  it('shows error block when api fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ message: 'API rate limit exceeded' }),
    })

    const { container } = render(
      <GitalkComponent
        options={{ clientID: 'i', clientSecret: 's', owner: 'o', repo: 'r', admin: 'o' }}
      />
    )

    await waitFor(() => {
      expect(container.querySelector('.gt-error')).toBeTruthy()
    })
    expect(container.querySelector('.gt-error')?.textContent).toContain('API rate limit exceeded')
  })

  it('toggles sort popup', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes('labels=')) return jsonResponse([issueFixture])
      if (url.includes('/comments')) return jsonResponse([commentFixture(1)])
      throw new Error(`unexpected fetch: ${url}`)
    })

    const { container } = render(
      <GitalkComponent
        options={{ clientID: 'i', clientSecret: 's', owner: 'o', repo: 'r', admin: 'o' }}
      />
    )
    await waitFor(() => expect(container.querySelector('.gt-user-inner')).toBeTruthy())

    expect(container.querySelector('.gt-popup')).toBeFalsy()
    fireEvent.click(container.querySelector('.gt-user-inner')!)
    await waitFor(() => expect(container.querySelector('.gt-popup')).toBeTruthy())
    // 未登录：弹层里只有登录入口，没有排序
    expect(container.querySelector('.gt-action-login')).toBeTruthy()
    expect(container.querySelector('.gt-action-sortasc')).toBeFalsy()
  })
})
