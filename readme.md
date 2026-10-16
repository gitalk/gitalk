# Gitalk 2.0

A comment component backed by **GitHub Discussions** (default) or GitHub Issues.
No backend, no database, no third-party proxy.

[中文文档](readme-cn.md) · [Demo](https://gitalk.github.io) · [Discussions](https://github.com/gitalk/gitalk/discussions)

## Quick start

Three steps. Step 1 is the only one that needs a browser and a repository you
administer; the rest is copy-paste.

### 1. Create a GitHub App

Gitalk 2.0 uses a **GitHub App**, not the 1.x OAuth App. The App is what lets
the token endpoint mint an installation token without shipping a secret to the
browser — and what keeps the client secret server-side for sign-in.

Follow **[docs/guide.md](docs/guide.md)** — it walks the
creation form field by field, including the callback URL, permissions and the
two settings that silently break sign-in if you get them wrong.

You will end up with:

- an App **Client ID** (looks like `Iv23li…`) — this goes in your page
- the App **installed** on the repository that will store your comments
- **Discussions** enabled on that repository, with a category

> The App's client secret never goes in your page. It lives in a token
> endpoint; see [The token endpoint](#the-token-endpoint).

### 2. Install the packages

```sh
pnpm add @aifire/gitalk          # framework-free
pnpm add @aifire/gitalk-react    # React
pnpm add @aifire/gitalk-vue      # Vue
```

Or skip the build step entirely:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@aifire/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/@aifire/gitalk@2/dist/gitalk.js"></script>
```

> Until the first release is published, these are not on the registry yet —
> build from source as described in [Development](#development).

### 3. Render it

**No framework**

```html
<div id="gitalk-container"></div>
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv23li…',     // your GitHub App client id
    owner: 'you',            // repository that stores the comments
    repo: 'blog-comments',
    admin: ['you'],          // who may create the thread on first visit
    number: 42               // the discussion number for this page
  })
  gitalk.render('gitalk-container')
</script>
```

**React**

```tsx
import { Gitalk } from '@aifire/gitalk-react'
import '@aifire/gitalk/style.css'

export function Comments() {
  return (
    <Gitalk
      options={{
        clientID: 'Iv23li…',
        owner: 'you',
        repo: 'blog-comments',
        admin: ['you'],
        number: 42
      }}
    />
  )
}
```

**Vue**

```vue
<script setup lang="ts">
import { Gitalk } from '@aifire/gitalk-vue'
import '@aifire/gitalk/style.css'

const options = {
  clientID: 'Iv23li…',
  owner: 'you',
  repo: 'blog-comments',
  admin: ['you'],
  number: 42
}
</script>

<template>
  <Gitalk :options="options" />
</template>
```

## Options

| Option | Default | Notes |
|---|---|---|
| `clientID` | — | Your GitHub App's client id |
| `owner`, `repo` | — | Repository hosting the discussions |
| `admin` | `[]` | Users who may create the thread |
| `backend` | `'discussions'` | or `'issues'` for existing 1.x installs |
| `number` | — | Discussion number. **Recommended**: avoids a title scan |
| `id` | `location.pathname` | Page identifier used when no `number` is given |
| `category` | — | Discussions category slug/name used when creating |
| `perPage` | `10` | Page size |
| `proxy` | hosted endpoint | Token-exchange endpoint; see below |
| `language` | `navigator.language` | 11 locales carried over from 1.x |

## The token endpoint

`github.com/login/oauth/access_token` sends no `Access-Control-Allow-Origin`
header, and the device flow is CORS-blocked too, so **a static page cannot
complete the OAuth exchange by itself**. Something server-side has to hold the
client secret.

By default Gitalk uses an endpoint this project runs, so you can leave `proxy`
unset:

```
https://gitalk-proxy.aispin-abf.workers.dev
```

If you would rather not depend on it, deploy your own from
[`packages/proxy-worker`](packages/proxy-worker). One command, free tier, about
a minute — see [docs/guide.md §第 3 步](docs/guide.md):

```sh
cp packages/proxy-worker/.env.example packages/proxy-worker/.env
# fill in the Cloudflare API token and your GitHub App credentials
pnpm --filter @gitalk/proxy-worker deploy
```

Then pass its URL:

```js
{ proxy: 'https://your-worker.your-subdomain.workers.dev' }
```

The endpoint only ever sees an OAuth code or an encrypted session — never your
client secret from the browser, and never a visitor's raw token in a URL.

## Rate limits

| Visitor | Path | Limit |
|---|---|---|
| Logged out | GitHub REST, straight from the browser | **60 requests/hour per IP** |
| Logged in | GitHub REST / GraphQL, with the visitor's own token | 5,000 per hour |

Comment reads do **not** go through the token endpoint — REST reads are
CORS-enabled and need no credential, so they go directly to `api.github.com`
and count against the anonymous per-IP budget. The 1.x ceiling therefore still
applies until a visitor signs in. Writing must use GraphQL (GitHub exposes no
REST write API for discussions), which is why posting requires signing in.
See [docs/tech.md §2.1](docs/tech.md) for the measured matrix.

Sessions last 30 days and renew silently when the App is configured to expire
access tokens; see [docs/tech.md §3.7](docs/tech.md).

## Migrating from 1.x

Your old comments live in Issues, so they will not appear in Discussions.
Pass `backend: 'issues'` to keep reading and writing them:

```js
{ backend: 'issues' }
```

The `clientID` still changes: 1.x used an OAuth App, 2.0 needs a GitHub App.

## What changed from 1.x

| | 1.x | 2.0 |
|---|---|---|
| Storage | GitHub Issues | **GitHub Discussions** (Issues optional) |
| Toolchain | webpack 3 · Babel 6 · Preact 8 | Vite 8 · TypeScript 7 · Preact 11 |
| Auth | `clientSecret` in the page + third-party CORS proxy | your own edge function, **no secret in the browser** |
| Versioning | standard-version | release-please |
| Builds | UMD only | ESM + IIFE + React + Vue |

Full rationale, including every measured API behaviour, is in
[docs/tech.md](docs/tech.md).

## Development

```sh
pnpm install
pnpm dev            # landing page with a live widget
pnpm test           # 68 tests
pnpm build          # all packages
pnpm typecheck
```

Releases are cut by release-please: merge the Release PR it opens and CI
publishes to npm via OIDC. See [.github/workflows/publish.yml](.github/workflows/publish.yml).

## License

MIT
