# @aifire/gitalk-deploy

Deploy the [Gitalk](https://github.com/gitalk/gitalk) proxy — the small service
that handles GitHub sign-in and comment writes — to **Cloudflare Workers** or
**Tencent CloudBase**.

Reading comments works without it. Deploying it is what lets readers **sign in**
and **post**, and it raises anonymous reads from GitHub's 60 requests/hour per IP
to 5,000/hour.

> **This file is the single source of truth for the setup steps.**
>
> Every other document — the repository README, `docs/guide.md`, the landing
> page — summarises these steps in one sentence and links here. When two
> documents disagree, this one wins.
>
> **中文版：[README-CN.md](./README-CN.md)** — the two files are the same
> document, step for step.

---

## The five steps

| # | Step | Where |
| --- | --- | --- |
| 1 | Create the GitHub App | your account or organisation settings |
| 2 | Write `.env`, deploy, then set the callback URL | your machine + GitHub |
| 3 | Prepare the repository: **public**, Discussions on, one category | GitHub |
| 4 | **Install the App on the repository** | GitHub |
| 5 | Embed the component | your site |

**Why this order:**

- The App is an **account- or organisation-level object**. Creating it has
  nothing to do with a repository — at that point you do not need to know which
  repository will use Gitalk.
- The repository has to **exist** before the App can be **installed** on it, so
  preparation (step 3) comes before installation (step 4).
- Deployment is independent of the repository. It is step 2 because it is the
  heaviest job — get it out of the way early.

Step 4 is the one people skip: **creating the App is not installing it**, and
without the installation the proxy cannot mint a token for your repository.

### The example this guide uses

Every command and snippet below is filled in for one concrete case. Substitute
your own names as you go; the shape stays the same.

| | Example value | Where it comes from |
| --- | --- | --- |
| App name | **My Niubi Gitalk** | the name you type in step 1 |
| App slug | `my-niubi-gitalk` | GitHub derives it: spaces become hyphens, letters lowercase |
| App owner | `octocat` (a personal account) | the account or organisation the App is created under |
| Repository | `octocat/demo-repo` | the repository that stores comments |
| Site origin | `https://octocat.github.io` | the blog or docs site that embeds the widget |
| Proxy | `https://my-niubi-gitalk.octocat.workers.dev` | printed by step 2 |
| Callback URL | `https://my-niubi-gitalk.octocat.workers.dev/oauth/callback` | proxy + `/oauth/callback` |

`octocat` is a stand-in for your own account or organisation, and `demo-repo`
for your own repository. `123456` and `Iv1.xxxxxxxxxxxx` are **example values**:
use the ones your App page shows, never copy these.

---

## Run it without npm

```bash
npx github:gitalk/deploy -c .env -t cloudflare
```

`npx` fetches the package from GitHub: no registry account, no install step.

---

## Step 1 — Create the GitHub App

**This is not in the repository's settings.** A GitHub App belongs to an
**account or an organisation**, so it is created at one of these two pages:

| Where the App should live | Create page |
| --- | --- |
| your personal account | <https://github.com/settings/apps> → **New GitHub App** |
| an organisation | <https://github.com/organizations/<Org Name>/settings/apps> → **New GitHub App** |

**Where the App lives decides where it can be installed.** An App created under
a personal account can only be installed on that person's repositories; one
created under an organisation can only be installed on that organisation's
repositories. Picking the wrong level is the usual cause of "the repository does
not appear on the install page". The repository's
**Settings → General → Features** is where Discussions is switched on — that is
step 3, a different page from this one.

This guide creates **My Niubi Gitalk** under `octocat` (a personal account), so
step 4 installs it on `octocat` and ticks `demo-repo`.

Fill the form in:

1. **Permissions → Repository permissions**
   - `Discussions: Read and write` — reading and posting comments
   - `Metadata: Read-only` — added automatically, cannot be removed
   - everything else: **No access**
2. **Callback URL: leave it empty.** It has to be
   `https://<the proxy address>/oauth/callback`, and the proxy does not exist
   until step 2 creates it. Step 2 comes back to this field. Guessing the
   address now is how people end up with `redirect_uri_mismatch`.
3. **Webhook**: untick *Active*. Gitalk does not use webhooks.
4. Note that this page is also the **only** place the callback URL can be
   changed later: organisation-owned Apps reject `PATCH /app` with a 404.

**The slug.** GitHub turns the App's name into a URL slug: spaces become
hyphens, letters become lowercase. `My Niubi Gitalk` therefore becomes
`my-niubi-gitalk` — the last segment of the App's public URL,
`https://github.com/apps/my-niubi-gitalk`, and the value step 4's install page
uses. If that slug is already taken, GitHub refuses the name; pick another and
your slug follows it (`gitalk`, `gitalk-app` and `gitalk-comments` are taken —
see [`docs/guide.md`](../../docs/guide.md)).

Write down the four values from that page:

| Value | For `My Niubi Gitalk` | Used as |
| --- | --- | --- |
| **App ID** | `123456` | `GITHUB_APP_ID` |
| **Client ID** | `Iv1.xxxxxxxxxxxx` (real Apps: `Iv23li…` or `Iv1.…`) | `GITHUB_CLIENT_ID`, and the component's `clientID` |
| **Client secret** | generated by *Generate a new client secret* | `GITHUB_CLIENT_SECRET` |
| **Private key** | `my-niubi-gitalk.private-key.pem` | `GITHUB_APP_PRIVATE_KEY`, as the whole file |

> ⚠️ The App page also shows a **fingerprint** like `SHA256:ab12…`. That is a
> checksum, **not the private key**. The CLI rejects it with a named error
> rather than failing later with a confusing one.

---

## Step 2 — Write `.env`, deploy, then set the callback URL

### 2a. What goes in `.env`

Every entry below is required. The CLI validates them before touching the
network and names the ones that are missing.

| Variable | Where it comes from |
| --- | --- |
| `GITHUB_APP_ID` | the App page (step 1) |
| `GITHUB_CLIENT_ID` | the App page (step 1) |
| `GITHUB_CLIENT_SECRET` | *Generate a new client secret* (step 1) |
| `GITHUB_APP_PRIVATE_KEY` | the `.pem` contents — **not** the `SHA256:` fingerprint |
| `SESSION_ENCRYPTION_KEY` | `openssl rand -hex 32` (32 random bytes, hex) |
| `GITALK_ALLOWED_ORIGINS` | the **site origins** allowed to call the proxy, comma-separated |

**`GITALK_ALLOWED_ORIGINS` is a list of sites, not repositories.** For the
example, the site is `https://octocat.github.io` plus whatever origin you
develop on. Write bare origins: no path, no trailing slash. It also decides
where the OAuth callback may send the visitor back — a site missing from this
list can sign in but lands on the proxy instead of the article.

Then add the credentials for the platform you deploy to.

**Cloudflare Workers** — create an API token at
<https://dash.cloudflare.com/profile/api-tokens> → *Create Token* → *Create
Custom Token*:

| Field | Value |
| --- | --- |
| Permissions | `Account` → **Workers Scripts** → **Edit** |
| Account Resources | Include → your account |
| Zone Resources | Leave empty unless you bind a custom domain |

```dotenv
CLOUDFLARE_API_TOKEN=…
# CLOUDFLARE_ACCOUNT_ID=…    # only when the token can see several accounts
```

If the deploy cannot determine the account, add `Account` → **Account
Settings** → **Read** and set `CLOUDFLARE_ACCOUNT_ID` (found under *Workers &
Pages*, right sidebar).

**Tencent CloudBase** — create the keys at
<https://console.cloud.tencent.com/cam> → *Users* → *Create user* → *Custom
creation*:

1. Choose **programmatic access only** (no console login). A dedicated
   sub-account is safer than root keys: it can be deleted independently and its
   permissions can be narrowed.
2. Attach the policy **`QcloudTCBFullAccess`** — all the deploy needs.
3. Copy the **SecretId** and **SecretKey**, and the environment ID from the
   CloudBase console (the string in the address bar, like `my-env-1a2b3c`).

```dotenv
CLOUDBASE_ENV_ID=…
CLOUDBASE_SECRET_ID=…
CLOUDBASE_SECRET_KEY=…
```

> ⚠️ The environment must be on a plan that allows **HTTP access**; the free
> trial has no default domain. A custom domain additionally needs an **ICP
> filing**. Neither can be done by this CLI.

The finished file, filled in for the example App:

```dotenv
# Both platforms
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxx
GITHUB_CLIENT_SECRET=…
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
…
-----END RSA PRIVATE KEY-----"
SESSION_ENCRYPTION_KEY=…            # openssl rand -hex 32
GITALK_ALLOWED_ORIGINS=https://octocat.github.io,http://127.0.0.1:5173

# Cloudflare only
CLOUDFLARE_API_TOKEN=…

# CloudBase only
CLOUDBASE_ENV_ID=…
CLOUDBASE_SECRET_ID=…
CLOUDBASE_SECRET_KEY=…
```

The App ID and Client ID above are the example's — replace them with the values
your App page shows. The private key keeps its newlines because it is quoted;
`.env` and the `.pem` are both in `.gitignore` and must never be committed.

**Custom domain (optional)** — a domain on Cloudflare can be bound directly; add
`Zone` → **Workers Routes** → **Edit** to the same token. On another registrar,
add a `CNAME` there by hand and list the address in `GITALK_ALLOWED_ORIGINS`.

### 2b. Deploy

```bash
npx github:gitalk/deploy -c .env -t cloudflare
npx github:gitalk/deploy -c .env -t cloudbase
npx github:gitalk/deploy -c .env -t cloudflare -n   # print the plan, change nothing
```

On success it prints the proxy URL and asks the deployed service for its health
(`/`, which answers `{"ok":true,"service":"gitalk-proxy"}`). With the worker
named `my-niubi-gitalk` on `octocat`'s account that is
`https://my-niubi-gitalk.octocat.workers.dev`. **Note that address** — 2c needs
it, and so does the component's `proxy`.

### 2c. Set the callback URL — only after the deploy

> **Wait for the address.** The callback URL is
> `https://<the address 2b printed>/oauth/callback`. Before the deploy the proxy
> does not exist, so there is nothing correct to type here yet.

Return to the App settings page and set **Callback URL** to
`https://my-niubi-gitalk.octocat.workers.dev/oauth/callback`. No path prefix, no
trailing slash.

> ⚠️ Skipping this shows up as `redirect_uri_mismatch` when a reader clicks
> *Sign in*. The change takes effect immediately; no redeploy is needed.

---

## Step 3 — Prepare the repository

The example repository is `octocat/demo-repo`. Create it if it does not exist
yet, then check two things under its **Settings**:

1. **It must be public.** The proxy's anonymous read path only serves public
   repositories — the visibility check fails closed, so a private repository
   gets `403` and every reader without their own access falls back to a REST
   read that fails too.
2. **Turn Discussions on:** *Settings → General → Features → Discussions*. Then
   open the **Discussions** tab and create at least one category (the default
   `General` is fine). New threads go into the first category GitHub returns
   unless you pin one with the `category` option.

The repository has to exist before step 4, because an App can only be installed
on a repository that is already there.

---

## Step 4 — Install the App on the repository

> **Creating the App is not enough.**
>
> Open <https://github.com/apps/my-niubi-gitalk/installations/new>. Pick
> `octocat`, choose **Only select repositories**, tick `demo-repo`, then click
> **Install**.

`demo-repo` only appears if the App belongs to the same account or organisation
that owns it — see step 1. For a different App or repository the URL is always
`https://github.com/apps/<slug>/installations/new` — the slug is the one from
step 1.

Why installation is required:

- The proxy signs a JWT as the App, looks up the installation
  (`GET /app/installations`) and exchanges it for an **installation token**
  (`POST /app/installations/{id}/access_tokens`).
- An installation token can only read the repositories the App is **installed
  on**. A freshly created App has no installation, so GitHub issues no token.
- Without a token the proxy answers anonymous reads with `503` and logs
  `no installation found for this app`; the widget falls back to GitHub REST at
  60 requests/hour per IP and logs `gitalk: proxy read failed`. On a busy page
  that looks like comments that never load, and on a private repository they
  never load at all.

Verify: <https://github.com/settings/installations> (for an organisation:
*Settings → GitHub Apps*) lists the App, and its repository list includes
`demo-repo`.

Installation is independent of the deploy: you may install before or after step
2. It sits here because this is the point where the repository exists and you
have decided it uses Gitalk.

---

## Step 5 — Embed the component

```js
const gitalk = new Gitalk({
  clientID: 'Iv1.xxxxxxxxxxxx', // example value — use your App's Client ID
  owner: 'octocat',             // user or organisation that owns the repository
  repo: 'demo-repo',            // repository NAME only — never `octocat/demo-repo`
  admin: ['octocat'],           // who may create the thread for a page
  number: 42,                   // the Discussion number for this page
  proxy: 'https://my-niubi-gitalk.octocat.workers.dev' // origin from 2b, no path
})

gitalk.render('gitalk-container')
```

- **`repo` is the repository name alone.** Writing `octocat/demo-repo` makes
  GitHub look for `octocat/octocat/demo-repo` and every request 404s.
- **`proxy` is an origin**, no path and no trailing slash.
- **`number` is recommended.** Without it the widget matches the Discussion
  title against `id` (default `location.pathname`), and an admin has to create
  each thread by hand the first time.
- **`backend`** defaults to `discussions`; pass `'issues'` to keep reading and
  writing 1.x Issues.
- **`clientSecret` is not used in the page.** In 2.0 it is held by the proxy
  you just deployed.
- Styling, dark mode and all eleven languages ship with the component.

---

## Many repositories and sites

One proxy can serve several repositories and several sites — for example
`octocat/demo-repo` plus a second repository. All three of these have to hold:

1. **The App is installed on every repository.** Use the same installation (one
   account or organisation, all the repositories it needs): the proxy looks up
   the first installation it finds.
2. **Every site origin is in `GITALK_ALLOWED_ORIGINS`.** Adding a site means
   editing that value and redeploying; adding a repository does not.
3. **The 5,000 requests/hour belong to the installation token** and are shared
   by every site behind that proxy. Signed-in readers use their own quota
   instead.

The repository's public/private verdict is cached for five minutes, so a
repository that turns private keeps working for anonymous readers for at most
that window.

---

## Can I use the hosted proxy?

No. The proxy this project runs
(`https://gitalk-proxy.aispin-abf.workers.dev`) has a **`GITALK_ALLOWED_ORIGINS`
list containing only this project's own sites**. A request from any other origin
is answered with a different origin's CORS header, so the browser rejects it
before GitHub is ever contacted — sign-in and the accelerated reads cannot work.

Every site that wants to use it has to be added to that list by hand, which is
an operator action, not something a reader of this README can do. Deploy your
own instead: one command, about five minutes, free tier.

---

## What it does

- Validates every value before touching the network, naming what is missing and
  where it comes from
- Uploads the App credentials as **secrets** — values go in through stdin, never
  through argv, which any process on the machine can read
- Deploys the bundled worker or function, then asks the deployed service whether
  it is healthy

## What it deliberately does not do

- **Create the GitHub App**, or **install it** — both are web forms
- **Edit the App's callback URL** — organisation-owned Apps reject API changes
- **Add DNS records** outside Cloudflare
- **Handle ICP filings** — a legal process, not a technical one

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `no installation found for this app` in the proxy logs; comments fall back to 60/hour | The App was created but never installed — do step 4 |
| `403` from the proxy for anonymous reads | The repository is private, or the App is not installed on it |
| The repository is missing on the install page | The App lives under a different account or organisation — see step 1 |
| `GITHUB_APP_PRIVATE_KEY — the .pem contents, not the fingerprint` | The `SHA256:…` string was pasted |
| `wrangler` cannot determine the account | The token sees several accounts — set `CLOUDFLARE_ACCOUNT_ID` |
| `403` from CloudBase | The sub-account lacks `QcloudTCBFullAccess` |
| Health check fails after a deploy | Check the function logs; usually a missing value |
| `redirect_uri_mismatch` when signing in | The App callback must be `<proxy>/oauth/callback`, set after 2b |
| Sign-in returns to the proxy instead of the article | The article's origin is missing from `GITALK_ALLOWED_ORIGINS` |
| `Discussions are disabled for octocat/demo-repo` | Turn Discussions on (step 3) and create a category |
