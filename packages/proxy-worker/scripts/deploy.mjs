#!/usr/bin/env node
/**
 * One-command deploy for the Gitalk proxy Worker.
 *
 * Reads `packages/proxy-worker/.env`, validates it, uploads the Worker, pushes
 * every value as an encrypted Cloudflare secret, then health-checks the result.
 *
 * The only thing you have to do by hand is create an API token:
 *   https://dash.cloudflare.com/profile/api-tokens -> "Edit Cloudflare Workers"
 *
 * Usage: pnpm --filter @gitalk/proxy-worker deploy
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKER_DIR = resolve(HERE, '..')
const REPO_ROOT = resolve(WORKER_DIR, '../..')
const ENV_FILE = join(WORKER_DIR, '.env')
const WRANGLER_CONFIG = join(WORKER_DIR, 'wrangler.toml')

const API = 'https://api.cloudflare.com/client/v4'
const WORKER_NAME = 'gitalk-proxy'

const color = (code, text) => `\u001b[${code}m${text}\u001b[0m`
const bold = (t) => color('1', t)
const dim = (t) => color('2', t)
const green = (t) => color('32', t)
const yellow = (t) => color('33', t)
const red = (t) => color('31', t)

const step = (n, text) => console.log(`\n${bold(`[${n}]`)} ${text}`)
const ok = (t) => console.log(`    ${green('✓')} ${t}`)
const warn = (t) => console.log(`    ${yellow('!')} ${t}`)
const die = (t) => {
  console.error(`\n${red('✗')} ${t}\n`)
  process.exit(1)
}

/* ------------------------------------------------------------------ *
 * .env parsing
 * ------------------------------------------------------------------ */

/**
 * Minimal dotenv reader.
 *
 * Deliberately dependency-free and forgiving: it accepts `KEY=value`,
 * `KEY="value"` and `KEY='value'`, ignores comments and blank lines, and does
 * not expand escapes — the private key relies on literal `\n` surviving
 * verbatim, so any unescaping here would break it.
 */
function readEnvFile(path) {
  const env = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eq = trimmed.indexOf('=')
    if (eq === -1) continue

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[key] = value
  }
  return env
}

/* ------------------------------------------------------------------ *
 * validation
 * ------------------------------------------------------------------ */

const REQUIRED = [
  ['GITHUB_APP_ID', 'the App ID from the GitHub App settings page'],
  ['GITHUB_CLIENT_ID', "the App's Client ID (looks like Iv1.… or Iv23li…)"],
  ['GITHUB_CLIENT_SECRET', 'a generated client secret'],
  ['SESSION_ENCRYPTION_KEY', 'run `openssl rand -hex 32`'],
  ['GITALK_ALLOWED_ORIGINS', 'comma-separated origins, e.g. https://gitalk.github.io']
]

/**
 * Reject the private-key mistakes that silently break token minting.
 *
 * The fingerprint column on the GitHub App settings page is the trap here: it
 * is a short `SHA256:…` string that looks key-shaped, gets pasted in, and only
 * fails later at runtime with an opaque error.
 */
function privateKeyProblem(value) {
  const v = (value ?? '').trim()

  if (!v) return 'missing'
  if (/^SHA256:/i.test(v)) {
    return (
      'this is the key FINGERPRINT from the GitHub App settings page, not the key.\n' +
      '      Open the downloaded .pem and flatten it into one line:\n' +
      `\n        awk 'NF {printf "%s\\\\n", $0}' ~/Downloads/<app>.private-key.pem\n`
    )
  }
  if (!/BEGIN (RSA )?PRIVATE KEY/.test(v) && !/^[A-Za-z0-9+/=\\n\s]+$/.test(v)) {
    return 'this does not look like a PEM private key'
  }
  if (v.replace(/\\n/g, '').length < 800) {
    return 'too short to be a 2048-bit RSA key — did you paste only part of it?'
  }
  return null
}

function validate(env) {
  const problems = []

  for (const [key, hint] of REQUIRED) {
    if (!env[key]?.trim()) problems.push(`${key} is missing — ${hint}`)
  }

  const keyProblem = privateKeyProblem(env.GITHUB_APP_PRIVATE_KEY)
  if (keyProblem) problems.push(`GITHUB_APP_PRIVATE_KEY: ${keyProblem}`)

  if (env.SESSION_ENCRYPTION_KEY && !/^[0-9a-fA-F]{64}$/.test(env.SESSION_ENCRYPTION_KEY.trim())) {
    problems.push('SESSION_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)')
  }
  if (env.GITHUB_APP_ID && !/^\d+$/.test(env.GITHUB_APP_ID.trim())) {
    problems.push('GITHUB_APP_ID must be numeric')
  }

  return problems
}

/* ------------------------------------------------------------------ *
 * process helpers
 * ------------------------------------------------------------------ */

function run(command, args, { input, env } = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: WORKER_DIR,
      env: { ...process.env, ...env },
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d) => (stdout += d))
    child.stderr?.on('data', (d) => (stderr += d))
    if (input !== undefined) {
      child.stdin.end(input)
    }

    child.on('close', (code) => resolvePromise({ code, stdout, stderr }))
  })
}

/** Locate wrangler without assuming a hoisted node_modules layout. */
function wranglerBinary() {
  const suffix = process.platform === 'win32' ? '.cmd' : ''
  for (const base of [join(WORKER_DIR, 'node_modules/.bin'), join(REPO_ROOT, 'node_modules/.bin')]) {
    const candidate = join(base, `wrangler${suffix}`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

async function wrangler(args, options) {
  const binary = wranglerBinary()
  if (!binary) die('wrangler not found — run `pnpm install` first.')
  return run(binary, args, options)
}

async function cf(path, token, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  })
  return response.json()
}

/* ------------------------------------------------------------------ *
 * main
 * ------------------------------------------------------------------ */

async function main() {
  console.log(bold('\nGitalk proxy — deploy\n'))

  if (!existsSync(WRANGLER_CONFIG)) die(`wrangler.toml not found at ${WRANGLER_CONFIG}`)

  step(1, 'Reading .env')
  if (!existsSync(ENV_FILE)) {
    die(
      `No .env at ${ENV_FILE}\n` +
        '  Copy .env.example to .env and fill it in. Keep it out of git — it holds secrets.'
    )
  }
  const env = readEnvFile(ENV_FILE)
  ok(`loaded ${Object.keys(env).length} keys`)

  // Fail loudly rather than deploy credentials into a public repo.
  const ignored = await run('git', ['check-ignore', '-q', ENV_FILE])
  if (ignored.code === 0) {
    ok('.env is git-ignored')
  } else {
    warn('.env is NOT git-ignored — add it to .gitignore before committing anything')
  }

  step(2, 'Validating')
  const token = env.CLOUDFLARE_API_TOKEN?.trim()
  if (!token) {
    die(
      'CLOUDFLARE_API_TOKEN is missing.\n' +
        '  Create one at https://dash.cloudflare.com/profile/api-tokens\n' +
        '  using the "Edit Cloudflare Workers" template, then add to .env:\n' +
        '    CLOUDFLARE_API_TOKEN=your-token'
    )
  }

  const problems = validate(env)
  if (problems.length) {
    console.error(`\n${red('✗')} .env has problems:\n`)
    for (const problem of problems) console.error(`    • ${problem}`)
    console.error('')
    process.exit(1)
  }
  ok('all required values look well-formed')

  step(3, 'Resolving Cloudflare account')
  let accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim()
  if (accountId) {
    ok(`using CLOUDFLARE_ACCOUNT_ID from .env: ${accountId}`)
  } else {
    const accounts = await cf('/accounts', token)
    if (!accounts.success) {
      die(`Could not list accounts: ${JSON.stringify(accounts.errors)}`)
    }
    const list = accounts.result ?? []
    if (list.length === 0) die('The token has no accessible accounts.')
    if (list.length > 1) {
      die(
        `The token can see ${list.length} accounts. Add the one you want to .env:\n` +
          list.map((a) => `    CLOUDFLARE_ACCOUNT_ID=${a.id}   # ${a.name}`).join('\n')
      )
    }
    accountId = list[0].id
    ok(`only one account visible: ${list[0].name} (${accountId})`)
  }

  const childEnv = { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId }

  step(4, 'Uploading the Worker')
  const deploy = await wrangler(['deploy'], { env: childEnv })
  if (deploy.code !== 0) {
    console.error(deploy.stdout)
    console.error(deploy.stderr)
    die('`wrangler deploy` failed.')
  }
  ok(`deployed ${WORKER_NAME}`)

  step(5, 'Pushing secrets')
  // Deploy first: `wrangler secret put` needs the script to exist. Wrangler
  // uploads the values over TLS and Cloudflare stores them encrypted; they are
  // never echoed here, and `.env` is not part of the deployed bundle.
  const secrets = [
    'GITHUB_APP_ID',
    'GITHUB_APP_PRIVATE_KEY',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'SESSION_ENCRYPTION_KEY',
    'GITALK_ALLOWED_ORIGINS'
  ]
  for (const name of secrets) {
    const result = await wrangler(['secret', 'put', name], {
      env: childEnv,
      input: env[name]
    })
    if (result.code !== 0) {
      const output = `${result.stdout}${result.stderr}`
      // 10053: the name is already bound, almost always because wrangler.toml
      // declares it under [vars] as well. Point at the actual fix.
      if (output.includes('10053')) {
        die(
          `Cloudflare rejected ${name}: a binding with that name already exists.\n` +
            `  Remove the matching entry from wrangler.toml so each name has exactly one source.`
        )
      }
      console.error(result.stdout)
      console.error(result.stderr)
      die(`Failed to set ${name}.`)
    }
    ok(name)
  }

  step(6, 'Checking the endpoint')
  const subdomain = await cf(`/accounts/${accountId}/workers/subdomain`, token)
  const zone = subdomain.result?.subdomain
  if (!zone) warn('could not read the workers.dev subdomain; skipping health check')

  let deployedUrl = null
  if (zone) {
    deployedUrl = `https://${WORKER_NAME}.${zone}.workers.dev`
    let body = ''
    try {
      const response = await fetch(deployedUrl)
      body = await response.text()
    } catch (error) {
      warn(`request to ${deployedUrl} failed: ${error.message}`)
    }
    if (body.includes('"ok":true')) {
      ok(`${deployedUrl} -> ${body.trim()}`)
    } else {
      warn(`${deployedUrl} returned: ${body.trim().slice(0, 120) || '(empty)'}`)
    }
  }

  step(7, 'Checking the widget default')
  const authPath = join(REPO_ROOT, 'packages/core/src/auth.ts')
  const expected = existsSync(authPath)
    ? readFileSync(authPath, 'utf8').match(/DEFAULT_PROXY\s*=\s*'([^']+)'/)?.[1]
    : null

  if (!deployedUrl || !expected) {
    warn('could not compare against DEFAULT_PROXY')
  } else if (expected === deployedUrl) {
    ok(`DEFAULT_PROXY matches (${expected})`)
  } else {
    warn(`DEFAULT_PROXY is ${expected}`)
    warn(`but the Worker is live at ${deployedUrl}`)
    console.log(
      `\n    Update these two places, or sign-in will fail at the OAuth callback:\n` +
        `      • packages/core/src/auth.ts  DEFAULT_PROXY\n` +
        `      • GitHub App settings -> Identifying and authorizing users -> Redirect URI\n` +
        `        must be ${deployedUrl}/oauth/callback\n`
    )
  }

  console.log(bold(green('\nDone.\n')))
}

main().catch((error) => {
  console.error(`\n${red('✗')} ${error.stack ?? error.message}\n`)
  process.exit(1)
})
