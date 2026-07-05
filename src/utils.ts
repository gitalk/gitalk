import { GitApiError } from './core/github/error'

export const queryParse = (search = window.location.search): Record<string, string> => {
  if (!search) return {}
  const queryString = search[0] === '?' ? search.substring(1) : search
  const query: Record<string, string> = {}
  queryString.split('&').forEach((queryStr) => {
    const [key, value] = queryStr.split('=')
    if (key) query[decodeURIComponent(key)] = decodeURIComponent(value ?? '')
  })
  return query
}

export const queryStringify = (query: Record<string, string | number | undefined>): string =>
  Object.keys(query)
    .map((key) => `${key}=${encodeURIComponent(query[key] ?? '')}`)
    .join('&')

export const getMetaContent = (name: string, content = 'content'): string | null => {
  const el = window.document.querySelector(`meta[name='${name}']`)
  return el && el.getAttribute(content)
}

export const formatErrorMsg = (err: unknown): string => {
  let msg = 'Error: '
  if (err instanceof GitApiError && err.data && err.data.message) {
    msg += `${err.data.message}. `
    if (Array.isArray(err.data.errors)) {
      msg += err.data.errors.map((e: { message: string }) => e.message).join(', ')
    }
  } else if (err instanceof Error) {
    msg += err.message
  } else {
    msg += String(err)
  }
  return msg
}

export const hasClassInParent = (element: Element | null, ...className: string[]): boolean => {
  if (!element || typeof element.className !== 'string') return false
  const classes = element.className.split(' ')
  if (className.some((c) => classes.indexOf(c) >= 0)) return true
  return element.parentNode ? hasClassInParent(element.parentNode as Element, ...className) : false
}

const TIME_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
]

// 替代 date-fns 的 formatDistanceToNow：原生 Intl.RelativeTimeFormat 支持全部语言
export const formatRelativeTime = (date: string | Date, locale: string): string => {
  const time = (typeof date === 'string' ? new Date(date) : date).getTime()
  if (Number.isNaN(time)) return ''
  const diffSeconds = Math.round((time - Date.now()) / 1000)

  let rtf: Intl.RelativeTimeFormat
  try {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  } catch {
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  }

  for (const [unit, seconds] of TIME_UNITS) {
    if (Math.abs(diffSeconds) >= seconds || unit === 'second') {
      return rtf.format(Math.trunc(diffSeconds / seconds), unit)
    }
  }
  return ''
}
