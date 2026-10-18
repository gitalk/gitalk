# @aifire/gitalk-deploy

Deploy the [Gitalk](https://github.com/gitalk/gitalk) proxy — the small service
that handles GitHub sign-in and comment writes — to Cloudflare Workers or
Tencent CloudBase.

Nothing here is required to **read** comments; it is what lets readers sign in
and post.

**中文说明见 [README-CN.md](./README-CN.md)。**

---

## Run it without npm

```bash
npx github:gitalk/deploy -c .env -t cloudflare
```

No registry account, no install step.

---

## Step 1 — Create the GitHub App

This is a web form; no script can do it.

1. <https://github.com/settings/apps/new> (or your organisation's
   *Settings → Developer settings → GitHub Apps → New*)
2. **Permissions → Repository permissions**
   - `Discussions: Read and write` — needed to read and post comments
   - `Metadata: Read-only` — added automatically, cannot be removed
   - Everything else: **No access**
3. **Callback URL**: `https://<your proxy address>/oauth/callback`
   - It can be edited later, but **only on this page**: organisation-owned Apps
     cannot be changed through the API (`PATCH /app` returns 404).
   - Up to 10 callback URLs are allowed, so a local and a production address can
     both be listed.
4. **Webhook**: untick *Active*. Gitalk does not use webhooks.
5. Create it, then note down:
   - **App ID** (a number)
   - **Client ID** (`Iv1.…` or `Iv23li…`)
   - **Client secret** — *Generate a new client secret*
   - **Private key** — *Generate a private key*, which downloads a `.pem`

> ⚠️ The App page also shows a **fingerprint** like `SHA256:ab12…`. That is not
> the key — it is a checksum. The CLI rejects it rather than failing later with
> a confusing error.

---

## Step 2 — Get the values for your platform

### Option A: Cloudflare Workers

**Create the API token** at
<https://dash.cloudflare.com/profile/api-tokens> → *Create Token* →
*Create Custom Token*:

| Field | Value |
| --- | --- |
| Permissions | `Account` → **Workers Scripts** → **Edit** |
| Account Resources | Include → your account |
| Zone Resources | Leave empty unless you bind a custom domain |

If the deploy says it cannot determine the account, also add
`Account` → **Account Settings** → **Read**, and set `CLOUDFLARE_ACCOUNT_ID`
(found under *Workers & Pages*, right sidebar).

```dotenv
CLOUDFLARE_API_TOKEN=…
# CLOUDFLARE_ACCOUNT_ID=…    # only when the token can see several accounts
```

**Custom domain (optional)** — only if the domain is also on Cloudflare: add
`Zone` → **Workers Routes** → **Edit** to the same token. On another registrar,
add a `CNAME` there by hand and list the address in `GITALK_ALLOWED_ORIGINS`.

### Option B: Tencent CloudBase

**Create the keys** at <https://console.cloud.tencent.com/cam> → *Users* →
*Create user* → *Custom creation*:

1. Choose **programmatic access only** (no console login). A dedicated
   sub-account is safer than root keys: it can be deleted independently, and its
   permissions can be narrowed.
2. Attach the policy **`QcloudTCBFullAccess`**. That is all the deploy needs —
   it creates and updates the function, nothing else.
3. Finish, then copy the **SecretId** and **SecretKey**.

**Find the environment ID** in the CloudBase console: it is the string in the
address bar, like `my-env-1a2b3c`.

```dotenv
CLOUDBASE_ENV_ID=…
CLOUDBASE_SECRET_ID=…
CLOUDBASE_SECRET_KEY=…
```

> ⚠️ The environment must be on a plan that allows **HTTP access**; the free
> trial has no default domain. A custom domain additionally needs an **ICP
> filing**. Neither can be done by this CLI.

---

## Step 3 — Write the dotenv file

```dotenv
# Both platforms
GITHUB_APP_ID=…
GITHUB_CLIENT_ID=Iv23li…
GITHUB_CLIENT_SECRET=…
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
…
-----END RSA PRIVATE KEY-----"
SESSION_ENCRYPTION_KEY=…            # openssl rand -hex 32
GITALK_ALLOWED_ORIGINS=https://blog.example,http://127.0.0.1:4181
```

`GITALK_ALLOWED_ORIGINS` lists the sites allowed to call the proxy — the blog's
origin, plus whatever local origin you develop on.

Add the platform block from step 2.

---

## Step 4 — Deploy

```bash
gitalk-deploy -c .env -t cloudflare     # or -t cloudbase
gitalk-deploy -c .env -t cloudflare -n  # print the steps, run nothing
```

On success it prints the URL and calls `/health`. Put that URL in your options:

```js
new Gitalk({
  clientID: 'Iv23li…',
  proxy: 'https://gitalk-proxy.<account>.workers.dev'
})
```

---

## What it does

- Validates every value before touching the network, naming what is missing and
  where each comes from
- Uploads the App credentials as **secrets** — values go in through stdin, never
  through argv, which any process on the machine can read
- Deploys the bundled worker or function, then asks `/health` whether it works

## What it deliberately does not do

- **Create the GitHub App** — a web form
- **Edit the App's callback URL** — organisation-owned Apps reject API changes
- **Add DNS records** outside Cloudflare
- **Handle ICP filings** — a legal process, not a technical one

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `GITHUB_APP_PRIVATE_KEY — the .pem contents, not the fingerprint` | The `SHA256:…` string was pasted |
| `wrangler` cannot determine the account | The token sees several accounts — set `CLOUDFLARE_ACCOUNT_ID` |
| `403` from CloudBase | The sub-account lacks `QcloudTCBFullAccess` |
| `/health` does not answer after a deploy | Check the function logs; usually a missing value |
| Sign-in redirects to the wrong place | The App callback must be `<proxy>/oauth/callback` |
