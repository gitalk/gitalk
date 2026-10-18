import { describe, expect, it } from 'vitest'
import { render } from 'preact'
import { authorAriaLabel, authorTitle, displayNameOf } from './display-name'
import { AuthorName } from './components/author-name'

/**
 * The fallback is the feature's safety property: `displayName` is optional and
 * GraphQL-only, so every path that prints it must degrade to the login instead
 * of an empty string.
 */
describe('displayNameOf', () => {
  it('prefers the nickname when present', () => {
    expect(displayNameOf({ login: 'booxood', displayName: 'Liucw' })).toBe('Liucw')
  })

  it('falls back to the login for missing, empty or whitespace-only names', () => {
    expect(displayNameOf({ login: 'booxood' })).toBe('booxood')
    expect(displayNameOf({ login: 'booxood', displayName: '' })).toBe('booxood')
    expect(displayNameOf({ login: 'booxood', displayName: '   ' })).toBe('booxood')
  })

  it('trims surrounding whitespace but keeps inner spaces and emoji', () => {
    expect(displayNameOf({ login: 'cnrkuo', displayName: '  Conor Kuo  ' })).toBe('Conor Kuo')
    expect(displayNameOf({ login: 'zhang', displayName: '张 三 🌟' })).toBe('张 三 🌟')
  })

  it('only adds an accessible label/tooltip when it differs from the login', () => {
    expect(authorAriaLabel({ login: 'cnrkuo', displayName: 'Conor Kuo' })).toBe(
      'Conor Kuo (@cnrkuo)'
    )
    expect(authorTitle({ login: 'cnrkuo', displayName: 'Conor Kuo' })).toBe('@cnrkuo')
    expect(authorAriaLabel({ login: 'cnrkuo' })).toBeUndefined()
    expect(authorTitle({ login: 'cnrkuo' })).toBeUndefined()
  })
})

describe('AuthorName', () => {
  it('renders a profile link with the nickname, labelled with both name and login', () => {
    const host = document.createElement('div')
    render(
      <AuthorName
        user={{ login: 'booxood', displayName: 'Liucw' }}
        href="https://github.com/booxood"
      />,
      host
    )

    const link = host.querySelector('a.gt-comment-username')!
    expect(link.textContent).toBe('Liucw')
    expect(link.getAttribute('href')).toBe('https://github.com/booxood')
    expect(link.getAttribute('aria-label')).toBe('Liucw (@booxood)')
    render(null, host)
  })

  it('renders plain text (no link) for a pending row', () => {
    const host = document.createElement('div')
    render(
      <AuthorName user={{ login: 'alice', displayName: 'Alice A.' }} />,
      host
    )

    const span = host.querySelector('span.gt-comment-username')!
    expect(span.textContent).toBe('Alice A.')
    expect(host.querySelector('a')).toBeNull()
    render(null, host)
  })
})
