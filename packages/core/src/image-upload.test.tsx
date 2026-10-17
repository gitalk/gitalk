import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'preact'
import { mount } from './mount'
import type {
  GitalkImageUploadContext,
  GitalkOptions,
  GitalkUploadedImage,
  GitalkUploadImageHandler
} from './types'
import { TOKEN_STORAGE_KEY } from './auth'

/**
 * Pluggable image upload, exercised through the real widget.
 *
 * The host site supplies `onUploadImage`; Gitalk only validates the returned
 * URLs, builds the Markdown itself, and inserts it at the caret. These tests
 * cover the visibility rules, the insertion/cancellation semantics, and the
 * failure UI — not any particular storage backend (there is none).
 */

const COMMENTS = [
  {
    id: 900,
    node_id: 'n900',
    user: { login: 'alice', avatar_url: 'a', html_url: 'u' },
    body_html: '<p>FIRST</p>',
    created_at: '2024-02-01T00:00:00Z',
    html_url: 'h',
    parent_id: null,
    child_comment_count: 0,
    reactions: { total_count: 0, heart: 0 }
  }
]

const THREAD = {
  number: 442,
  node_id: 'D442',
  title: 'demo',
  html_url: 'u',
  locked: false,
  comments: COMMENTS.length
}

describe('image upload', () => {
  let host: HTMLElement
  let previewBodies: string[]
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    previewBodies = []

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/graphql')) return json({ data: {} })
      if (url.endsWith('/markdown')) {
        const body = JSON.parse(String(init?.body)) as { text: string }
        previewBodies.push(body.text)
        return new Response('<p>preview</p>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        })
      }
      if (url.includes('/issues/442/comments')) return json(COMMENTS)
      if (url.includes('/issues/442')) return json({ ...THREAD })
      if (url.includes('/comments')) return json(COMMENTS)
      if (url.includes('/user')) return json({ login: 'alice', avatar_url: 'a' })
      if (url.includes('/discussions/442')) return json(THREAD)
      return json({})
    }) as typeof fetch
  })

  afterEach(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    globalThis.fetch = originalFetch
    render(null, host)
    host.remove()
  })

  function json(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  async function mountWidget(extra: Partial<GitalkOptions> = {}, signedIn = true) {
    if (signedIn) localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
    else localStorage.removeItem(TOKEN_STORAGE_KEY)
    mount(host, {
      clientID: 'c',
      owner: 'gitalk',
      repo: 'gitalk',
      admin: [],
      number: 442,
      id: 'p',
      perPage: 10,
      ...extra
    } as GitalkOptions)
    await waitFor(() => host.querySelector('.gt-comment'))
    return host.querySelector('.gt-header-textarea') as HTMLTextAreaElement
  }

  function file(name = 'cat.png', type = 'image/png'): File {
    return new File([new Uint8Array([1, 2, 3])], name, { type })
  }

  async function choose(files: File[]) {
    const input = host.querySelector('.gt-image-input') as HTMLInputElement
    Object.defineProperty(input, 'files', { configurable: true, value: files })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flush()
  }

  function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }

  function uploadButton(): HTMLButtonElement {
    return host.querySelector('.gt-btn-upload-image') as HTMLButtonElement
  }

  it('does not render the control when onUploadImage is not configured', async () => {
    await mountWidget()
    expect(uploadButton()).toBeNull()
    expect(host.querySelector('.gt-image-input')).toBeNull()
  })

  it('does not render the control for an anonymous visitor', async () => {
    const handler = vi.fn(async () => ['https://cdn.test/cat.png'])
    await mountWidget({ onUploadImage: handler }, false)

    expect(host.querySelector('.gt-btn-public')).toBeNull()
    expect(uploadButton()).toBeNull()
  })

  it('opens the hidden file picker when the button is clicked', async () => {
    await mountWidget({ onUploadImage: vi.fn(async () => ['https://cdn.test/cat.png']) })

    const input = host.querySelector('.gt-image-input') as HTMLInputElement
    const click = vi.spyOn(input, 'click')
    uploadButton().click()
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('never calls the handler for a non-image file', async () => {
    const handler = vi.fn<GitalkUploadImageHandler>(async () => ['https://cdn.test/cat.png'])
    await mountWidget({ onUploadImage: handler })

    await choose([file('notes.txt', 'text/plain')])
    expect(handler).not.toHaveBeenCalled()
    expect(host.querySelector('.gt-image-error[role="alert"]')).toBeTruthy()
  })

  it('marks the button busy and disabled while uploading, showing progress', async () => {
    const pending = deferred<Array<GitalkUploadedImage | string>>()
    const handler = vi.fn((_files: File[], ctx: GitalkImageUploadContext) => {
      ctx.onProgress?.(1, 2)
      return pending.promise
    })
    await mountWidget({ onUploadImage: handler })

    await choose([file()])

    const button = uploadButton()
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain('50%')
    expect(host.querySelector('.gt-btn-upload-cancel')).toBeTruthy()

    // Settle the promise so the test leaves no upload behind.
    pending.resolve(['https://cdn.test/cat.png'])
    await flush()
    expect(uploadButton().getAttribute('aria-busy')).toBeNull()
    expect(uploadButton().disabled).toBe(false)
  })

  it('inserts at the caret and keeps the surrounding draft', async () => {
    const handler = vi.fn(async () => ['https://cdn.test/cat.png'])
    const textarea = await mountWidget({ onUploadImage: handler })

    textarea.value = 'hello world'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    textarea.setSelectionRange(5, 5)

    await choose([file()])

    const markdown = '![cat.png](https://cdn.test/cat.png)'
    expect(textarea.value).toBe(`hello${markdown} world`)
    expect(textarea.selectionStart).toBe(5 + markdown.length)
  })

  it('surfaces a failure with role="alert" and retries the original files', async () => {
    const handler = vi
      .fn<GitalkUploadImageHandler>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(['https://cdn.test/cat.png'])
    const textarea = await mountWidget({ onUploadImage: handler })
    const first = file()

    await choose([first])

    const alert = host.querySelector('.gt-image-error[role="alert"]')
    expect(alert).toBeTruthy()
    expect(alert?.textContent).toContain('Image upload failed')
    expect(alert?.textContent).toContain('boom')

    const retry = host.querySelector('.gt-btn-upload-retry') as HTMLButtonElement
    expect(retry).toBeTruthy()
    retry.click()
    await flush()

    expect(handler).toHaveBeenCalledTimes(2)
    // Retry reuses the exact File objects, not a fresh selection.
    expect(handler.mock.calls[1]![0]).toEqual([first])
    expect(textarea.value).toContain('![cat.png](https://cdn.test/cat.png)')
    expect(host.querySelector('.gt-image-error')).toBeNull()
  })

  it('reports a timeout instead of staying busy forever', async () => {
    const handler = vi.fn<GitalkUploadImageHandler>(
      () => new Promise<Array<GitalkUploadedImage | string>>(() => {})
    )
    await mountWidget({ onUploadImage: handler, imageUploadTimeout: 10 })

    await choose([file()])
    await new Promise((r) => setTimeout(r, 30))
    await flush()

    expect(host.querySelector('.gt-image-error')?.textContent).toContain(
      'Image upload timed out'
    )
    expect(uploadButton().getAttribute('aria-busy')).toBeNull()
    expect(uploadButton().disabled).toBe(false)
  })

  it('cancels silently and discards a result that arrives afterwards', async () => {
    const pending = deferred<Array<GitalkUploadedImage | string>>()
    let signal: AbortSignal | undefined
    const handler = vi.fn((_files: File[], ctx: GitalkImageUploadContext) => {
      signal = ctx.signal
      return pending.promise
    })
    const textarea = await mountWidget({ onUploadImage: handler })

    textarea.value = 'keep me'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()

    await choose([file()])
    ;(host.querySelector('.gt-btn-upload-cancel') as HTMLButtonElement).click()
    await flush()

    expect(signal?.aborted).toBe(true)
    expect(host.querySelector('.gt-image-error')).toBeNull()
    expect(uploadButton().getAttribute('aria-busy')).toBeNull()

    // The handler ignored the signal and resolved anyway: still no insertion.
    pending.resolve(['https://cdn.test/late.png'])
    await flush()
    expect(textarea.value).toBe('keep me')
    expect(textarea.value).not.toContain('late.png')
  })

  it('rejects a data: URL returned by the handler and inserts nothing', async () => {
    const handler = vi.fn(async () => ['data:image/png;base64,AAAA'])
    const textarea = await mountWidget({ onUploadImage: handler })

    textarea.value = 'unchanged'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()

    await choose([file()])

    expect(host.querySelector('.gt-image-error')?.textContent).toContain(
      'Image URL must be an absolute http(s) URL'
    )
    expect(textarea.value).toBe('unchanged')
  })

  it('sends the inserted Markdown to the auto preview endpoint', async () => {
    const handler = vi.fn(async () => ['https://cdn.test/cat.png'])
    const textarea = await mountWidget({ onUploadImage: handler })

    await choose([file()])
    expect(textarea.value).toContain('https://cdn.test/cat.png')

    // No Preview button: the draft insertion itself schedules the panel.
    expect(host.querySelector('.gt-btn-preview')).toBeNull()
    await waitFor(() => (previewBodies.length ? host.querySelector('.preview-body') : null))

    expect(previewBodies.at(-1)).toContain('![cat.png](https://cdn.test/cat.png)')
    expect(host.querySelector('.preview-body')?.textContent).toContain('preview')
  })

  it('appends to the end while the auto preview hides the caret', async () => {
    const handler = vi.fn(async () => ['https://cdn.test/cat.png'])
    const textarea = await mountWidget({ onUploadImage: handler })

    textarea.value = 'hello world'
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
    await flush()
    textarea.setSelectionRange(5, 5)

    // Wait for the debounced auto preview, which is what makes the caret
    // unavailable to the insertion path.
    await waitFor(() => host.querySelector('.preview-body'))

    await choose([file()])

    expect(textarea.value).toBe(
      'hello world![cat.png](https://cdn.test/cat.png)'
    )
  })

  it('inserts all files in order, and nothing on a count mismatch', async () => {
    const two = vi.fn(async () => [
      'https://cdn.test/a.png',
      'https://cdn.test/b.png'
    ])
    const textarea = await mountWidget({ onUploadImage: two })
    await choose([file('a.png'), file('b.png')])
    expect(textarea.value).toBe(
      '![a.png](https://cdn.test/a.png)\n\n![b.png](https://cdn.test/b.png)'
    )

    // A handler that loses a file must not leave a partial selection behind.
    const short = vi.fn(async () => ['https://cdn.test/only.png'])
    render(null, host)
    host.remove()
    host = document.createElement('div')
    document.body.appendChild(host)
    localStorage.setItem(TOKEN_STORAGE_KEY, 'test-token')
    const secondTextarea = await mountWidget({ onUploadImage: short })

    await choose([file('x.png'), file('y.png')])
    expect(secondTextarea.value).toBe('')
    expect(host.querySelector('.gt-image-error')?.textContent).toContain(
      'Image upload failed'
    )
  })
})

async function waitFor(pred: () => Element | null, timeoutMs = 1500): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (pred()) return
    await new Promise((r) => setTimeout(r, 0))
  }
  throw new Error('timed out waiting for widget')
}

function flush(): Promise<void> {
  return new Promise((r) => setTimeout(r, 25))
}
