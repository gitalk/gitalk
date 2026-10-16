# Gitalk 2.0

A comment component backed by **GitHub Discussions** (default) or GitHub Issues.
No backend, no database, no third-party proxy.

[中文文档](readme-cn.md) · [Demo](https://gitalk.github.io) · [Discussions](https://github.com/gitalk/gitalk/discussions)

## What changed from 1.x

| | 1.x | 2.0 |
|---|---|---|
| Storage | GitHub Issues | **GitHub Discussions** (Issues optional) |
| Toolchain | webpack 3 · Babel 6 · Preact 8 | Vite 8 · TypeScript 7 · Preact 11 |
| Auth | `clientSecret` in the page + third-party CORS proxy | your own edge function, **no secret in the browser** |
| Versioning | standard-version | release-please |
| Builds | UMD only | ESM + IIFE + React + Vue |

Full rationale, including every measured API behaviour, is in [docs/tech.md](docs/tech.md).

## Install

```sh
pnpm add @gitalk/core       # framework-free
pnpm add @gitalk/react      # React
pnpm add @gitalk/vue        # Vue
```

## Usage

### No framework

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<div id="gitalk-container"></div>
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    number: 42,              // discussion number; recommended
    backend: 'discussions'
  })
  gitalk.render('gitalk-container')
</script>
```

### React

```tsx
import { Gitalk } from '@gitalk/react'
import '@gitalk/core/style.css'

<Gitalk options={{ clientID: 'Iv1.xxxxxxxx', owner: 'you', repo: 'comments', admin: ['you'], number: 42 }} />
```

### Vue

```vue
<script setup lang="ts">
import { Gitalk } from '@gitalk/vue'
import '@gitalk/core/style.css'

const options = { clientID: 'Iv1.xxxxxxxx', owner: 'you', repo: 'comments', admin: ['you'], number: 42 }
</script>

<template>
  <Gitalk :options="options" />
</template>
```

## Options

| Option | Default | Notes |
|---|---|---|
| `clientID` | — | OAuth Application client id |
| `owner`, `repo` | — | Repository hosting the discussions |
| `admin` | `[]` | Users who may create the thread |
| `backend` | `'discussions'` | or `'issues'` for existing 1.x installs |
| `number` | — | Discussion number. **Recommended**: avoids a title scan |
| `id` | `location.pathname` | Page identifier used when no `number` is given |
| `category` | — | Discussions category slug/name used when creating |
| `perPage` | `10` | Page size |
| `proxy` | — | Your deployed token-exchange endpoint |
| `language` | `navigator.language` | 11 locales carried over from 1.x |

## Setup

1. **Enable Discussions** on the repository, then create a category (default: `General`).
2. **Register an OAuth Application** and note the client id. Do not put the
   client secret in your page.
3. **Deploy the token proxy** from [`packages/proxy-worker`](packages/proxy-worker)
   to Cloudflare Workers, Vercel or Netlify, and set
   `GITALK_CLIENT_ID` / `GITALK_CLIENT_SECRET` / `GITALK_ALLOWED_ORIGINS`.
4. Pass its URL as `proxy`.

### Why a proxy?

`github.com/login/oauth/access_token` returns no `Access-Control-Allow-Origin`
header, so a browser cannot complete the OAuth exchange itself. We measured
this for the device flow as well — it needs no `client_secret`, but it is
CORS-blocked too. There is therefore no way for a purely static page to obtain
a token; see [docs/tech.md §3.2](docs/tech.md).

The proxy keeps the secret out of your bundle and off any third-party server.

## Anonymous reading

Anonymous visitors read comments over the REST API (60 requests/hour per IP).
With `ETag`/`If-None-Match`, unchanged responses are not counted. Logged-in
users go through GraphQL (5000 points/hour), which is required for writing —
GitHub exposes no REST write API for discussions.

## Development

```sh
pnpm install
pnpm dev            # landing page with live widget
pnpm test           # 28 tests
pnpm build          # all packages
pnpm typecheck
```

## License

MIT
