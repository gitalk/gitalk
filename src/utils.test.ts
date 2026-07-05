import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  queryParse,
  queryStringify,
  formatErrorMsg,
  getMetaContent,
  hasClassInParent,
  formatRelativeTime,
} from './utils'
import { GitApiError } from './core/github/error'

describe('utils', () => {
  const search = 'a=b&c=1'
  const searchObject = { a: 'b', c: '1' }

  describe('queryParse', () => {
    it('parses plain query string', () => {
      expect(queryParse(search)).toEqual(searchObject)
    })
    it('parses query string with leading ?', () => {
      expect(queryParse(`?${search}`)).toEqual(searchObject)
    })
    it('returns empty object for empty search', () => {
      expect(queryParse('')).toEqual({})
    })
  })

  describe('queryStringify', () => {
    it('serializes object', () => {
      expect(queryStringify(searchObject)).toEqual(search)
    })
    it('serializes empty value', () => {
      expect(queryStringify({ a: '' })).toEqual('a=')
    })
    it('encodes value', () => {
      expect(queryStringify({ a: 'hello world' })).toEqual('a=hello%20world')
    })
  })

  describe('getMetaContent', () => {
    afterEach(() => {
      document.head.innerHTML = ''
    })
    it('reads meta content', () => {
      document.head.innerHTML = `<meta name="description" content="desc-content">`
      expect(getMetaContent('description')).toEqual('desc-content')
    })
    it('reads custom content attribute', () => {
      document.head.innerHTML = `<meta name="description" og:description="og-content">`
      expect(getMetaContent('description', 'og:description')).toEqual('og-content')
    })
    it('returns null when meta missing', () => {
      expect(getMetaContent('nope')).toBeNull()
    })
  })

  describe('hasClassInParent', () => {
    it('finds class on ancestors', () => {
      const parent = document.createElement('div')
      parent.className = 'parent-class'
      const child = document.createElement('span')
      child.className = 'child-class'
      parent.appendChild(child)

      expect(hasClassInParent(child, 'parent-class')).toBe(true)
      expect(hasClassInParent(child, 'not-exist')).toBe(false)
    })
  })

  describe('formatErrorMsg', () => {
    it('formats GitApiError with message and errors', () => {
      const err = new GitApiError(422, {
        message: 'm1',
        errors: [{ message: 'm21' }, { message: 'm22' }],
      })
      expect(formatErrorMsg(err)).toEqual('Error: m1. m21, m22')
    })
    it('formats plain Error', () => {
      expect(formatErrorMsg(new Error('m1'))).toEqual('Error: m1')
    })
  })

  describe('formatRelativeTime', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('formats past dates', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
      expect(formatRelativeTime('2026-07-05T10:00:00Z', 'en')).toBe('2 hours ago')
      expect(formatRelativeTime('2026-07-03T12:00:00Z', 'zh-CN')).toBe('前天')
    })

    it('falls back to en for unknown locale', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-07-05T12:00:00Z'))
      expect(formatRelativeTime('2026-06-05T12:00:00Z', '!!invalid!!')).toBe('last month')
    })

    it('returns empty string for invalid date', () => {
      expect(formatRelativeTime('not-a-date', 'en')).toBe('')
    })
  })
})
