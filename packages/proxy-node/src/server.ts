/**
 * Container / VPS entry point.
 *
 * `@gitalk/proxy-core` is written against Web-standard `Request`/`Response`,
 * so this file is just the translation layer between those and Node's
 * `http.IncomingMessage` / `http.ServerResponse`. No business logic here —
 * if you find yourself editing this file to change behaviour, the change
 * belongs in proxy-core instead.
 *
 * Node 20+ is required: `Request`/`Response`/`crypto.subtle`/`fetch` are all
 * globals there, and core depends on every one of them.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import { handle, type Env } from '@gitalk/proxy-core'

const PORT = Number(process.env.PORT ?? 8787)
/** Used to resolve the request URL; only the path matters to core. */
const ORIGIN = process.env.PUBLIC_ORIGIN ?? `http://127.0.0.1:${PORT}`

/**
 * The App private key, from wherever it was provided.
 *
 * `GITHUB_APP_PRIVATE_KEY` is the usual route and accepts the flattened
 * single-line form as well as a real multi-line PEM. `GITHUB_APP_PRIVATE_KEY_FILE`
 * is for the cases where a file is easier — the downloaded `.pem` exactly as
 * GitHub served it, which also avoids putting 1.7 KB into a container env var.
 * The CF deploy script resolves the same two sources, so one `.env` drives all
 * three targets.
 */
function readPrivateKey(): string {
  const inline = process.env.GITHUB_APP_PRIVATE_KEY
  if (inline?.trim()) return inline

  const path = process.env.GITHUB_APP_PRIVATE_KEY_FILE
  if (!path) return ''
  try {
    return readFileSync(path, 'utf8')
  } catch (err) {
    fail(`GITHUB_APP_PRIVATE_KEY_FILE is set but could not be read: ${(err as Error).message}`)
  }
}

function fail(message: string): never {
  console.error(`gitalk-proxy: ${message}`)
  process.exit(1)
}

/** Environment variables core expects, read straight off the process. */
function readEnv(): Env {
  return {
    GITHUB_APP_ID: process.env.GITHUB_APP_ID ?? '',
    GITHUB_APP_PRIVATE_KEY: readPrivateKey(),
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? '',
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ?? '',
    SESSION_ENCRYPTION_KEY: process.env.SESSION_ENCRYPTION_KEY ?? '',
    GITALK_ALLOWED_ORIGINS: process.env.GITALK_ALLOWED_ORIGINS ?? '',
    GITHUB_INSTALLATION_ID: process.env.GITHUB_INSTALLATION_ID
  }
}

/**
 * Refuse to start on missing config.
 *
 * Core would otherwise fail deep inside a request with `Invalid keyData` or an
 * opaque GitHub 401, which tells an operator nothing about what to fix.
 */
function assertConfigured(env: Env): void {
  const missing: string[] = []
  const check = (name: keyof Env, value: string | undefined) => {
    if (!value?.trim()) missing.push(name)
  }

  check('GITHUB_APP_ID', env.GITHUB_APP_ID)
  check('GITHUB_APP_PRIVATE_KEY', env.GITHUB_APP_PRIVATE_KEY)
  check('GITHUB_CLIENT_ID', env.GITHUB_CLIENT_ID)
  check('GITHUB_CLIENT_SECRET', env.GITHUB_CLIENT_SECRET)
  check('SESSION_ENCRYPTION_KEY', env.SESSION_ENCRYPTION_KEY)

  if (missing.length) {
    fail(
      `missing required configuration: ${missing.join(', ')}\n` +
        '  Provide them as environment variables, or point\n' +
        '  GITHUB_APP_PRIVATE_KEY_FILE at the downloaded .pem.'
    )
  }

  if (!/^[0-9a-fA-F]{64}$/.test(env.SESSION_ENCRYPTION_KEY.trim())) {
    fail('SESSION_ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)')
  }
}

function toWebRequest(req: IncomingMessage, body: Buffer): Request {
  const url = new URL(req.url ?? '/', ORIGIN)
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
    else if (value !== undefined) headers.set(key, value)
  }

  const method = (req.method ?? 'GET').toUpperCase()
  const sendBody = method !== 'GET' && method !== 'HEAD' && body.length > 0
  // Every endpoint here takes JSON, so decoding to text keeps the types honest
  // (a raw Buffer is a Uint8Array, but not assignable to BodyInit under TS's
  // generic ArrayBuffer types). A binary route would need a real byte handoff.
  const payload = sendBody ? body.toString('utf8') : undefined
  return new Request(url, { method, headers, body: payload })
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  // Payloads here are small JSON documents; buffering keeps this adapter free
  // of stream-type juggling for no measurable cost.
  res.end(Buffer.from(await response.arrayBuffer()))
}

// Resolved once: reading the key file per request would be pointless work, and
// a misconfigured deployment should be obvious at boot rather than at first use.
const ENV = readEnv()
assertConfigured(ENV)

const server = createServer((req, res) => {
  void (async () => {
    try {
      const request = toWebRequest(req, await readBody(req))
      // A Worker's ExecutionContext is per-request scratch space plus waitUntil.
      // Core only uses it as a token cache scoped to the request, so a minimal
      // stand-in reproduces its behaviour exactly.
      const ctx = { props: undefined as Record<string, unknown> | undefined, waitUntil: () => {} }
      const response = await handle(request, ENV, ctx)
      await writeWebResponse(res, response)
    } catch (err) {
      console.error('proxy error:', err)
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
      }
      res.end(JSON.stringify({ error: 'Proxy request failed' }))
    }
  })()
})

server.listen(PORT, () => {
  console.log(`gitalk-proxy listening on ${ORIGIN} (port ${PORT})`)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
