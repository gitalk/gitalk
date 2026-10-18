import { describe, expect, it } from 'vitest'
import {
  MENTION_LIMIT,
  collectParticipants,
  filterCandidates,
  insertMention,
  mentionQueryAt
} from './mentions'
import type { GitalkComment, GitalkReply } from './types'

function reply(login: string): GitalkReply {
  return {
    id: Math.floor(Math.random() * 1e6),
    nodeId: null,
    user: { login, avatarUrl: `av/${login}`, htmlUrl: `u/${login}` },
    bodyHtml: '',
    createdAt: '2024-01-01T00:00:00Z',
    htmlUrl: 'h',
    reactions: { totalCount: 0, viewerHasReacted: false },
    isAuthor: false
  }
}

function comment(login: string, replies: GitalkReply[] = []): GitalkComment {
  return { ...reply(login), replies } as GitalkComment
}

describe('mentionQueryAt', () => {
  it('opens on a bare @ at the start of the text', () => {
    expect(mentionQueryAt('@', 1)).toEqual({ start: 0, query: '' })
  })

  it('opens after whitespace and reports what has been typed since', () => {
    expect(mentionQueryAt('hello @ali', 10)).toEqual({ start: 6, query: 'ali' })
    expect(mentionQueryAt('a\n@b', 4)).toEqual({ start: 2, query: 'b' })
  })

  it('reads the token at the caret, not at the end of the value', () => {
    // Caret sits right after "@al"; the rest of the line is ignored.
    expect(mentionQueryAt('@al and more', 3)).toEqual({ start: 0, query: 'al' })
  })

  it('stays shut inside a word, as in an email address', () => {
    expect(mentionQueryAt('user@example.com', 12)).toBeNull()
  })

  it('closes once the visitor types a space or a second @', () => {
    expect(mentionQueryAt('@alice bob', 10)).toBeNull()
    expect(mentionQueryAt('@a@b', 4)).toBeNull()
  })

  it('is null when there is no @ before the caret at all', () => {
    expect(mentionQueryAt('plain text', 10)).toBeNull()
    expect(mentionQueryAt('@alice', 0)).toBeNull()
  })
})

describe('collectParticipants', () => {
  it('de-duplicates authors and repliers, case-insensitively, in screen order', () => {
    const participants = collectParticipants([
      comment('alice', [reply('Bob'), reply('ALICE')]),
      comment('carol', [reply('bob')])
    ])
    expect(participants.map((p) => p.login)).toEqual(['alice', 'Bob', 'carol'])
    expect(participants[0]!.avatarUrl).toBe('av/alice')
  })

  it('can leave the viewer out, so nobody is offered themselves', () => {
    const participants = collectParticipants([comment('alice'), comment('bob')], 'ALICE')
    expect(participants.map((p) => p.login)).toEqual(['bob'])
  })

  it('skips the ghost account GitHub uses for deleted users', () => {
    expect(collectParticipants([comment('ghost'), comment('alice')]).map((p) => p.login)).toEqual([
      'alice'
    ])
  })

  it('offers the login, never the display name, as a mention target', () => {
    const booxood = comment('booxood')
    booxood.user.displayName = 'Liucw'
    const participants = collectParticipants([booxood])

    // `@Liucw` is not a GitHub account; the inserted token must be `@booxood`.
    expect(participants).toEqual([{ login: 'booxood', avatarUrl: 'av/booxood' }])
    expect(insertMention('@li', { start: 0, caret: 3 }, participants[0]!.login).text).toBe(
      '@booxood '
    )
  })
})

describe('filterCandidates', () => {
  const candidates = [
    { login: 'bob', avatarUrl: '' },
    { login: 'alice', avatarUrl: '' },
    { login: 'alicia', avatarUrl: '' },
    { login: 'carol', avatarUrl: '' }
  ]

  it('returns everyone, alphabetically, for a bare @', () => {
    expect(filterCandidates(candidates, '').map((c) => c.login)).toEqual([
      'alice',
      'alicia',
      'bob',
      'carol'
    ])
  })

  it('prefers prefix matches over substring matches', () => {
    expect(filterCandidates(candidates, 'ali').map((c) => c.login)).toEqual(['alice', 'alicia'])
    expect(filterCandidates(candidates, 'ar').map((c) => c.login)).toEqual(['carol'])
  })

  it('matches case-insensitively and caps the list', () => {
    expect(filterCandidates(candidates, 'BO').map((c) => c.login)).toEqual(['bob'])
    const many = Array.from({ length: 20 }, (_, i) => ({ login: `user${i}`, avatarUrl: '' }))
    expect(filterCandidates(many, 'user')).toHaveLength(MENTION_LIMIT)
  })

  it('offers nothing when the prefix matches nobody', () => {
    expect(filterCandidates(candidates, 'zzz')).toEqual([])
  })
})

describe('insertMention', () => {
  it('inserts at the caret, not at the end of the text', () => {
    // "@al and more" with the caret after "@al"
    const result = insertMention('@al and more', { start: 0, caret: 3 }, 'alice')
    expect(result.text).toBe('@alice  and more')
    expect(result.caret).toBe('@alice '.length)
  })

  it('replaces the whole token when the caret is at its end', () => {
    const result = insertMention('hi @bo', { start: 3, caret: 6 }, 'bob')
    expect(result.text).toBe('hi @bob ')
    expect(result.caret).toBe(8)
  })

  it('clamps a caret that is out of range', () => {
    expect(insertMention('@x', { start: 0, caret: 99 }, 'bob').text).toBe('@bob ')
  })
})
