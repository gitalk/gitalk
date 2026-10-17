# @aifire/gitalk-deploy

Deploy the [Gitalk](https://github.com/gitalk/gitalk) proxy — the small service
that handles GitHub sign-in and comment writes — to Cloudflare Workers or
Tencent CloudBase.

Nothing here is required to **read** comments; it is what lets readers sign in
and post.

## Run it without npm

```bash
npx github:gitalk/deploy -c .env -t cloudflare
```

## Before you run it

1. **Create a GitHub App** — this part is a web form, and no script can do it.
   In *Settings → Developer settings → GitHub Apps*:
   - Permissions: **Discussions: Read and write**, **Metadata: Read-only**
   - Callback URL: `<your proxy URL>/oauth/callback`
   - Turn off *Webhook* (unused)
2. **Put the values in a dotenv file**:

   ```dotenv
   GITHUB_APP_ID=…
   GITHUB_CLIENT_ID=Iv23li…
   GITHUB_CLIENT_SECRET=…
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
   …
   -----END RSA PRIVATE KEY-----"
   SESSION_ENCRYPTION_KEY=…          # openssl rand -hex 32
   GITALK_ALLOWED_ORIGINS=https://blog.example

   # Cloudflare
   CLOUDFLARE_API_TOKEN=…            # Workers Scripts: Edit

   # or CloudBase
   CLOUDBASE_ENV_ID=…
   CLOUDBASE_SECRET_ID=…
   CLOUDBASE_SECRET_KEY=…
   ```

   The private key must be the **`.pem` contents**, not the `SHA256:…`
   fingerprint the App page also shows. The CLI rejects the fingerprint.

## Use it

```bash
gitalk-deploy -c .env -t cloudflare          # deploy
gitalk-deploy -c .env -t cloudflare -n       # print the steps, run nothing
gitalk-deploy -c .env -t cloudbase           # the Tencent Cloud option
```

On success it prints the proxy URL and checks `/health`. Put that URL in your
Gitalk options:

```js
new Gitalk({ clientID, proxy: 'https://gitalk-proxy.<account>.workers.dev' })
```

## What it does

- Validates every value before touching the network, and names the missing ones
- Uploads the App credentials as **secrets** — values go in through stdin, never
  through argv, which any process on the machine can read
- Deploys the bundled worker or function, then asks `/health` whether it works

## Custom domains

If the domain is on Cloudflare, bind it there and add the proxy URL to
`GITALK_ALLOWED_ORIGINS`. Everywhere else needs a `CNAME` record added by hand,
and CloudBase additionally requires an ICP filing. The GitHub App's callback URL
always has to be edited in the web UI: organisation-owned Apps cannot be changed
through the API.
