import { describe, expect, it } from 'vitest'
import {
  buildImageMarkdown,
  escapeMarkdownAlt,
  isAcceptableUrl,
  normalizeUploadResult,
  withTimeout
} from './images'
import { GitalkImageUploadError } from './types'

function file(name: string, type = 'image/png'): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type })
}

describe('image upload helpers', () => {
  it('builds the canonical Markdown shape', () => {
    expect(buildImageMarkdown({ url: 'https://cdn.test/cat.png', alt: 'a cat' })).toBe(
      '![a cat](https://cdn.test/cat.png)'
    )
    // No alt supplied: the widget passes the file name as the default.
    expect(buildImageMarkdown({ url: 'https://cdn.test/cat.png' })).toBe(
      '![](https://cdn.test/cat.png)'
    )
  })

  it('escapes alt text so it cannot terminate the label or inject HTML', () => {
    expect(escapeMarkdownAlt('a]b[c\\d\ne')).toBe('a\\]b\\[c\\\\d e')
    expect(escapeMarkdownAlt('<b>woof</b>')).toBe('\\<b\\>woof\\</b\\>')
  })

  it('wraps destinations containing spaces or parentheses in angle brackets', () => {
    expect(buildImageMarkdown({ url: 'https://cdn.test/a b(1).png', alt: 'shot' })).toBe(
      '![shot](<https://cdn.test/a b(1).png>)'
    )
    // A plain URL stays unwrapped.
    expect(buildImageMarkdown({ url: 'https://cdn.test/a.png', alt: 'shot' })).toBe(
      '![shot](https://cdn.test/a.png)'
    )
  })

  it('only accepts absolute http(s) URLs without credentials', () => {
    expect(isAcceptableUrl('https://cdn.test/a.png')).toBe(true)
    expect(isAcceptableUrl('http://cdn.test/a.png')).toBe(true)

    expect(isAcceptableUrl('data:image/png;base64,AAAA')).toBe(false)
    expect(isAcceptableUrl('blob:https://page.test/1234')).toBe(false)
    expect(isAcceptableUrl('javascript:alert(1)')).toBe(false)
    expect(isAcceptableUrl('/relative/a.png')).toBe(false)
    expect(isAcceptableUrl('a.png')).toBe(false)
    expect(isAcceptableUrl('https://user:pass@cdn.test/a.png')).toBe(false)
    expect(isAcceptableUrl(`https://cdn.test/${'a'.repeat(4096)}`)).toBe(false)
  })

  it('rejects on timeout, aborting the controller it was given', async () => {
    const controller = new AbortController()
    const never = new Promise<string>(() => {})

    await expect(
      withTimeout(never, 5, {
        signal: controller.signal,
        files: [file('cat.png')],
        onTimeout: () => controller.abort()
      })
    ).rejects.toMatchObject({ code: 'timeout' })

    expect(controller.signal.aborted).toBe(true)
  })

  it('rejects an abort even when the handler settles later', async () => {
    const controller = new AbortController()
    const never = new Promise<string>(() => {})
    const pending = withTimeout(never, 0, { signal: controller.signal })

    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'aborted' })
  })

  it('rejects a result whose length does not match the selection', () => {
    const files = [file('a.png'), file('b.png')]
    expect(() => normalizeUploadResult(['https://cdn.test/a.png'], files)).toThrow(
      GitalkImageUploadError
    )
    try {
      normalizeUploadResult(['https://cdn.test/a.png'], files)
      throw new Error('expected normalizeUploadResult to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(GitalkImageUploadError)
      expect((err as GitalkImageUploadError).code).toBe('count-mismatch')
      // The original files travel with the error, so the UI can offer retry.
      expect((err as GitalkImageUploadError).files).toBe(files)
    }
  })

  it('accepts a plain string array and defaults alt to the file name', () => {
    const files = [file('cat photo.png'), file('dog.png')]
    expect(
      normalizeUploadResult(['https://cdn.test/cat.png', 'https://cdn.test/dog.png'], files)
    ).toEqual([
      { url: 'https://cdn.test/cat.png', alt: 'cat photo.png' },
      { url: 'https://cdn.test/dog.png', alt: 'dog.png' }
    ])
  })

  it('rejects any non-http(s) URL in the batch, not just the first', () => {
    const files = [file('ok.png'), file('bad.png')]
    expect(() =>
      normalizeUploadResult(['https://cdn.test/ok.png', 'data:image/png;base64,AAAA'], files)
    ).toThrow(GitalkImageUploadError)

    try {
      normalizeUploadResult(['https://cdn.test/ok.png', 'blob:https://page.test/x'], files)
    } catch (err) {
      expect((err as GitalkImageUploadError).code).toBe('invalid-url')
    }
  })
})
