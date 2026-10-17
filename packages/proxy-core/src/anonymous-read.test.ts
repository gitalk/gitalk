// @vitest-environment node
import { beforeAll, describe, expect, it, vi, afterEach } from 'vitest'
import { ANONYMOUS_READ_QUERIES, handle, parseOperation, type Env } from './index'
import { ANONYMOUS_READ_QUERIES as CORE_READ_QUERIES } from '../../core/src/api/read-queries'

/**
 * The anonymous read accelerator is a security-sensitive feature: it lends the
 * GitHub App installation token — which can read every repository the App is
 * installed on — to callers with no GitHub account. These tests pin the
 * boundaries, not just the happy path:
 *
 *  - only the canonical, repository-scoped read documents run;
 *  - mutations and unknown names are 401 and never acquire a token;
 *  - a private repository is refused before any GraphQL call;
 *  - the public verdict is cached, but the token itself is never exposed.
 */

const PROXY_ORIGIN = 'https://proxy.example'

let privateKeyPem = ''

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign']
  )) as CryptoKeyPair

  const der = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  let binary = ''
  for (const byte of der) binary += String.fromCharCode(byte)
  const base64 = btoa(binary)
  const lines = base64.match(/.{1,64}/g) ?? []
  privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`
})

afterEach(() => vi.restoreAllMocks())

/**
 * Each test gets its own App id so the in-isolate installation-token cache
 * cannot leak a credential from an earlier test into a failure case.
 */
function envFor(suffix: string): Env {
  return {
    GITHUB_APP_ID: `anonymous-read-${suffix}`,
    GITHUB_APP_PRIVATE_KEY: privateKeyPem,
    GITHUB_CLIENT_ID: 'Iv23liTestClient',
    GITHUB_CLIENT_SECRET: 'client-secret',
    SESSION_ENCRYPTION_KEY: 'ab'.repeat(32),
    GITALK_ALLOWED_ORIGINS: 'https://site.example',
    GITHUB_INSTALLATION_ID: '77'
  }
}

interface UpstreamCall {
  url: string
  method: string
  auth: string | null
  ifNoneMatch: string | null
  body: unknown
}

/** Stub GitHub and record every upstream request. */
function stubGitHub(
  handler: (call: UpstreamCall) => { status?: number; body?: unknown; headers?: Record<string, string> }
): UpstreamCall[] {
  const calls: UpstreamCall[] = []

  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers as Record<string, string> | undefined) ?? {}
    const call: UpstreamCall = {
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      auth: headers.Authorization ?? null,
      ifNoneMatch: headers['If-None-Match'] ?? null,
      body: init?.body ? JSON.parse(String(init.body)) : null
    }
    calls.push(call)

    const result = handler(call)
    return new Response(result.status === 304 ? null : JSON.stringify(result.body ?? {}), {
      status: result.status ?? 200,
      headers: { 'Content-Type': 'application/json', ...result.headers }
    })
  })

  return calls
}

const call = (body: unknown, env: Env, headers: Record<string, string> = {}) =>
  handle(
    new Request(`${PROXY_ORIGIN}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body)
    }),
    env,
    { waitUntil() {} }
  )

const INSTALLATION_TOKEN = 'ghs_installation_secret'
const PUBLIC_REPO = (owner: string, repo: string) => ({
  private: false,
  full_name: `${owner}/${repo}`
})

/** The minimal variables a comments read needs. */
const COMMENT_VARIABLES = {
  owner: 'gitalk',
  repo: 'gitalk',
  number: 442,
  first: 10,
  last: null,
  after: null,
  before: null
}

describe('anonymous GraphQL reads', () => {
  it('executes a whitelisted read with the installation token', async () => {
    const calls = stubGitHub((upstream) => {
      if (upstream.url.includes('/access_tokens')) {
        return { body: { token: INSTALLATION_TOKEN, expires_at: '2099-01-01T00:00:00Z' } }
      }
      if (upstream.url.includes('/repos/')) {
        return { body: PUBLIC_REPO('gitalk', 'gitalk') }
      }
      return {
        body: {
          data: {
            repository: {
              discussion: { comments: { totalCount: 0, nodes: [] } }
            }
          }
        }
      }
    })

    const response = await call(
      {
        // Deliberately not the canonical text: the operation name is the
        // capability, and the proxy must execute its own audited document
        // rather than this one.
        query: 'query gitalkDiscussionComments { viewer { login } }',
        variables: COMMENT_VARIABLES
      },
      envFor('happy')
    )

    expect(response.status).toBe(200)
    expect((await response.json()).data.repository.discussion.comments.totalCount).toBe(0)

    const graphql = calls.find((c) => c.url.endsWith('/graphql'))!
    expect(graphql.auth).toBe(`Bearer ${INSTALLATION_TOKEN}`)
    expect(graphql.body).toMatchObject({
      query: ANONYMOUS_READ_QUERIES.gitalkDiscussionComments,
      variables: COMMENT_VARIABLES
    })
    // The caller's `viewer` selection never reached GitHub.
    expect(JSON.stringify(graphql.body)).not.toContain('viewer {')
  })

  it('rejects an unknown operation name without touching GitHub', async () => {
    const calls = stubGitHub(() => ({ body: { data: {} } }))

    const response = await call(
      {
        query:
          'query gitalkPrivateData($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { id } }',
        variables: { owner: 'gitalk', repo: 'gitalk' }
      },
      envFor('unknown')
    )

    expect(response.status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('rejects the existing viewer/node-scoped read queries', async () => {
    // `gitalkReactionStates` and `gitalkDiscussionUpvote` are read-only, but
    // they take arbitrary node ids and report viewer state. With an
    // installation token they would be a key to every node the App can see,
    // not a repository-scoped read, so they are deliberately NOT allowlisted.
    const calls = stubGitHub(() => ({ body: { data: {} } }))

    const reactionStates = await call(
      {
        query: 'query gitalkReactionStates($ids: [ID!]!) { nodes(ids: $ids) { id } }',
        variables: { ids: ['D_kwDO_private'] }
      },
      envFor('reaction-states')
    )
    expect(reactionStates.status).toBe(401)

    const upvote = await call(
      {
        query: 'query gitalkDiscussionUpvote($id: ID!) { node(id: $id) { id } }',
        variables: { id: 'D_kwDO_private' }
      },
      envFor('upvote-read')
    )
    expect(upvote.status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('rejects a mutation even when it reuses an allowlisted name', async () => {
    const calls = stubGitHub(() => ({ body: { data: {} } }))

    const response = await call(
      {
        query:
          'mutation gitalkDiscussionComments { addDiscussionComment(input: {}) { clientMutationId } }',
        variables: COMMENT_VARIABLES
      },
      envFor('mutation')
    )

    expect(response.status).toBe(401)
    expect(calls).toHaveLength(0)
  })

  it('ignores comments when deciding which operation runs', async () => {
    const calls = stubGitHub((upstream) => {
      if (upstream.url.includes('/access_tokens')) {
        return { body: { token: INSTALLATION_TOKEN, expires_at: '2099-01-01T00:00:00Z' } }
      }
      if (upstream.url.includes('/repos/')) return { body: PUBLIC_REPO('gitalk', 'gitalk') }
      return { body: { data: { repository: { id: 'R_1' } } } }
    })

    // The tokenizer ignores comments and strings, so neither can smuggle a
    // second operation past the "exactly one query" rule.
    const commented = await call(
      {
        query: '# mutation gitalkDiscussionComments\nquery gitalkDiscussionComments { repository { id } }',
        variables: COMMENT_VARIABLES
      },
      envFor('comment')
    )
    expect(commented.status).toBe(200)

    const twoOperations = await call(
      {
        query:
          'query gitalkDiscussionComments { repository { id } }\nmutation gitalkDiscussionComments { addDiscussionComment(input: {}) { clientMutationId } }',
        variables: COMMENT_VARIABLES
      },
      envFor('two-ops')
    )
    expect(twoOperations.status).toBe(401)
    expect(calls.filter((c) => c.url.endsWith('/graphql'))).toHaveLength(1)
  })

  it('refuses a private repository before executing anything', async () => {
    const calls = stubGitHub((upstream) => {
      if (upstream.url.includes('/access_tokens')) {
        return { body: { token: INSTALLATION_TOKEN, expires_at: '2099-01-01T00:00:00Z' } }
      }
      if (upstream.url.includes('/repos/')) {
        return { body: { private: true, full_name: 'acme/secret' } }
      }
      return { body: { data: { repository: { discussion: null } } } }
    })

    const response = await call(
      {
        query: 'query gitalkDiscussion($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { id } }',
        variables: { owner: 'acme', repo: 'secret', number: 1 }
      },
      envFor('private')
    )

    expect(response.status).toBe(403)
    expect(calls.some((c) => c.url.endsWith('/graphql'))).toBe(false)
    // The visibility check itself must use the installation token; a plain
    // anonymous REST check would 404 on exactly the repositories we must deny.
    expect(calls.find((c) => c.url.includes('/repos/'))?.auth).toBe(`Bearer ${INSTALLATION_TOKEN}`)
  })

  it('rejects an internal repository even when `private` is false', async () => {
    const calls = stubGitHub((upstream) => {
      if (upstream.url.includes('/access_tokens')) {
        return { body: { token: INSTALLATION_TOKEN, expires_at: '2099-01-01T00:00:00Z' } }
      }
      if (upstream.url.includes('/repos/')) {
        return { body: { private: false, visibility: 'internal', full_name: 'acme/internal' } }
      }
      return { body: { data: {} } }
    })

    const response = await call(
      {
        query: 'query gitalkDiscussion($owner: String!, $repo: String!, $number: Int!) { repository { id } }',
        variables: { owner: 'acme', repo: 'internal', number: 1 }
      },
      envFor('internal')
    )

    expect(response.status).toBe(403)
    expect(calls.some((c) => c.url.endsWith('/graphql'))).toBe(false)
  })

  it('caches the public-repository verdict across reads', async () => {
    const calls = stubGitHub((upstream) => {
      if (upstream.url.includes('/access_tokens')) {
        return { body: { token: INSTALLATION_TOKEN, expires_at: '2099-01-01T00:00:00Z' } }
      }
      if (upstream.url.includes('/repos/')) {
        return { body: PUBLIC_REPO('cached', 'repo') }
      }
      return { body: { data: { repository: { discussion: { comments: { totalCount: 1, nodes: [] } } } } } }
    })

    const env = envFor('cached')
    for (let i = 0; i < 2; i++) {
      const response = await call(
        {
          query: 'query gitalkDiscussionComments { repository { id } }',
          variables: { ...COMMENT_VARIABLES, owner: 'cached', repo: 'repo' }
        },
        env
      )
      expect(response.status).toBe(200)
    }

    expect(calls.filter((c) => c.url.includes('/repos/'))).toHaveLength(1)
    expect(calls.filter((c) => c.url.includes('/access_tokens'))).toHaveLength(1)
    expect(calls.filter((c) => c.url.endsWith('/graphql'))).toHaveLength(2)
  })

  it('fails with 503 when no installation token can be obtained', async () => {
    const calls = stubGitHub((upstream) => {
      if (upstream.url.includes('/access_tokens')) return { status: 401, body: { message: 'Bad credentials' } }
      return { body: { data: {} } }
    })

    const response = await call(
      {
        query: 'query gitalkDiscussion($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { id } }',
        variables: { owner: 'tokenless', repo: 'repo', number: 1 }
      },
      envFor('no-token')
    )

    expect(response.status).toBe(503)
    expect(calls.some((c) => c.url.includes('/repos/'))).toBe(false)
    expect(calls.some((c) => c.url.endsWith('/graphql'))).toBe(false)
  })

  it('rejects malformed or oversized pagination variables', async () => {
    const calls = stubGitHub(() => ({ body: { data: {} } }))

    const tooMany = await call(
      {
        query: 'query gitalkDiscussionComments { repository { id } }',
        variables: { ...COMMENT_VARIABLES, first: 1000 }
      },
      envFor('too-many')
    )
    expect(tooMany.status).toBe(400)

    const bothEnds = await call(
      {
        query: 'query gitalkDiscussionComments { repository { id } }',
        variables: { ...COMMENT_VARIABLES, last: 10 }
      },
      envFor('both-ends')
    )
    expect(bothEnds.status).toBe(400)

    expect(calls).toHaveLength(0)
  })

  it('does not let a path-like owner or repo reach the visibility URL', async () => {
    const calls = stubGitHub(() => ({ body: { data: {} } }))

    const response = await call(
      {
        query: 'query gitalkDiscussion($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { id } }',
        variables: { owner: '../../etc', repo: 'passwd', number: 1 }
      },
      envFor('path')
    )

    expect(response.status).toBe(400)
    expect(calls).toHaveLength(0)
  })
})

describe('anonymous read cache headers', () => {
  it('forwards ETag / Cache-Control and If-None-Match instead of eating them', async () => {
    const calls = stubGitHub((upstream) => {
      if (upstream.url.includes('/access_tokens')) {
        return { body: { token: INSTALLATION_TOKEN, expires_at: '2099-01-01T00:00:00Z' } }
      }
      if (upstream.url.includes('/repos/')) return { body: PUBLIC_REPO('cache', 'headers') }
      return {
        body: { data: { repository: { discussion: { comments: { totalCount: 0, nodes: [] } } } } },
        headers: {
          ETag: '"read-etag"',
          'Cache-Control': 'public, max-age=60',
          'Last-Modified': 'Wed, 01 Jan 2025 00:00:00 GMT',
          Vary: 'Authorization'
        }
      }
    })

    const response = await call(
      {
        query: 'query gitalkDiscussionComments { repository { id } }',
        variables: { ...COMMENT_VARIABLES, owner: 'cache', repo: 'headers' }
      },
      envFor('headers'),
      { 'If-None-Match': '"previous"' }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('ETag')).toBe('"read-etag"')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60')
    expect(response.headers.get('Last-Modified')).toBe('Wed, 01 Jan 2025 00:00:00 GMT')
    expect(response.headers.get('Access-Control-Expose-Headers')).toContain('ETag')
    // CORS needs `Origin`; GitHub's own `Vary` must not be replaced by it.
    expect(response.headers.get('Vary')).toContain('Origin')
    expect(response.headers.get('Vary')).toContain('Authorization')
    expect(calls.find((c) => c.url.endsWith('/graphql'))?.ifNoneMatch).toBe('"previous"')
  })

  it('passes a 304 through without a body and keeps its cache headers', async () => {
    stubGitHub((upstream) => {
      if (upstream.url.includes('/access_tokens')) {
        return { body: { token: INSTALLATION_TOKEN, expires_at: '2099-01-01T00:00:00Z' } }
      }
      if (upstream.url.includes('/repos/')) return { body: PUBLIC_REPO('cache', 'not-modified') }
      return { status: 304, headers: { ETag: '"read-etag"', 'Cache-Control': 'public, max-age=60' } }
    })

    const response = await call(
      {
        query: 'query gitalkDiscussionComments { repository { id } }',
        variables: { ...COMMENT_VARIABLES, owner: 'cache', repo: 'not-modified' }
      },
      envFor('not-modified'),
      { 'If-None-Match': '"read-etag"' }
    )

    expect(response.status).toBe(304)
    expect(await response.text()).toBe('')
    expect(response.headers.get('ETag')).toBe('"read-etag"')
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60')
  })
})

describe('parseOperation', () => {
  it('reads the type and name while ignoring comments and string contents', () => {
    expect(parseOperation('query Named($x: String = "}") { a }')).toEqual({
      type: 'query',
      name: 'Named'
    })
    expect(parseOperation('# leading comment\nmutation DoIt { a }')).toEqual({
      type: 'mutation',
      name: 'DoIt'
    })
    expect(parseOperation('{ a }')).toEqual({ type: 'query', name: null })
    expect(parseOperation('query { a }')).toEqual({ type: 'query', name: null })
  })

  it('rejects multiple operations, fragments and trailing tokens', () => {
    expect(parseOperation('query A { a } query B { b }')).toBeNull()
    expect(parseOperation('query A { a } fragment F on T { b }')).toBeNull()
    expect(parseOperation('query A { a } trailing')).toBeNull()
    expect(parseOperation('mutation A { a }')).toMatchObject({ type: 'mutation' })
  })
})

describe('canonical query drift', () => {
  it('keeps the proxy documents in step with packages/core', () => {
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
    for (const [name, coreQuery] of Object.entries(CORE_READ_QUERIES)) {
      const proxyQuery = (ANONYMOUS_READ_QUERIES as Record<string, string>)[name]
      expect(proxyQuery, `proxy is missing ${name}`).toBeTruthy()
      expect(normalize(proxyQuery!)).toBe(normalize(coreQuery))
    }
  })
})
