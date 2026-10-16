#!/usr/bin/env node
/**
 * Deploy the token endpoint to Tencent CloudBase as a Web function.
 *
 * Same contract as the Cloudflare script: read the shared `.env`, resolve the
 * App private key from either the environment variable or the downloaded
 * `.pem`, and fail with an actionable message rather than a stack trace.
 *
 * The difference is authentication. CloudBase has no equivalent of a scoped
 * Cloudflare API token — `tcb login --apiKeyId/--apiKey` takes a Tencent Cloud
 * API key, which acts on every resource the account can reach. Use a
 * sub-account with the CloudBase preset policy (`QcloudAccessForTCBRole`) and
 * never the root account's key. See docs/deploy.md.
 *
 * Usage: pnpm --filter @gitalk/proxy-cloudbase deploy
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG_DIR = resolve(HERE, '..')
const REPO_ROOT = resolve(PKG_DIR, '../..')
const WORKER_DIR = join(REPO_ROOT, 'packages/proxy-worker')

/** Values the function needs at runtime, injected through `{{env.X}}`. */
const REQUIRED = [
  ['CLOUDBASE_ENV_ID', 'the CloudBase environment id'],
  ['CLOUDBASE_SECRET_ID', 'a Tencent Cloud API SecretId (use a sub-account)'],
  ['CLOUDBASE_SECRET_KEY', 'the matching SecretKey'],
  ['GITHUB_APP_ID', 'the App ID from the GitHub App settings page'],
  ['GITHUB_CLIENT_ID', "the App's Client ID"],
  ['GITHUB_CLIENT_SECRET', 'a generated client secret'],
  ['SESSION_ENCRYPTION_KEY', 'run `openssl rand -hex 32`'],
  ['GITALK_ALLOWED_ORIGINS', 'comma-separated origins']
]

const bold = (t) => `\u001b[1m${t}\u001b[0m`
const dim = (t) => `\u001b[2m${t}\u001b[0m`
const green = (t) => `\u001b[32m${t}\u001b[0m`
const yellow = (t) => `\u001b[33m${t}\u001b[0m`
const red = (t) => `\u001b[31m${t}\u001b[0m`

const step = (n, t) => console.log(`\n${bold(`[${n}]`)} ${t}`)
const ok = (t) => console.log(`    ${green('✓')} ${t}`)
const warn = (t) => console.log(`    ${yellow('!')} ${t}`)
const die = (t) => {
  console.error(`\n${red('✗')} ${t}\n`)
  process.exit(1)
}

/** Minimal dotenv reader — same rules as the Cloudflare script. */
function readEnvFile(path) {
  const env = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
    const eq = trimmed.indexOf('=')
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    env[trimmed.slice(0, eq).trim()] = value
  }
  return env
}

/**
 * The App private key, from the environment or the downloaded `.pem`.
 *
 * CloudBase env variables are single-line strings, so the key is flattened
 * with literal `\n` escapes — the form `pemToPkcs8` already accepts, and the
 * same one a `wrangler secret` gets.
 */
function resolvePrivateKey(env) {
  const inline = env.GITHUB_APP_PRIVATE_KEY?.trim()
  if (inline) return inline

  const pems = readdirSync(WORKER_DIR).filter((name) => name.endsWith('.pem'))
  if (pems.length === 0) {
    die(
      'GITHUB_APP_PRIVATE_KEY is empty and no .pem was found in packages/proxy-worker.\n' +
        '  Drop the downloaded private key there, or set the variable in .env.'
    )
  }
  if (pems.length > 1) {
    die(`found ${pems.length} .pem files in packages/proxy-worker; keep only one:\n` + pems.map((n) => `      ${n}`).join('\n'))
  }

  const raw = readFileSync(join(WORKER_DIR, pems[0]), 'utf8')
  ok(`private key read from ${pems[0]}`)
  return raw
    .split('\n')
    .filter((line) => line.trim())
    .join('\\n')
    .concat('\\n')
}

function run(command, args, cwd) {
  return new Promise((done) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('close', (code) => done({ code, stdout, stderr }))
  })
}

/** `tcb` lives in this package's node_modules after `pnpm install`. */
function tcbBinary() {
  const suffix = process.platform === 'win32' ? '.cmd' : ''
  for (const base of [join(PKG_DIR, 'node_modules/.bin'), join(REPO_ROOT, 'node_modules/.bin')]) {
    const candidate = join(base, `tcb${suffix}`)
    if (existsSync(candidate)) return candidate
  }
  return null
}

async function main() {
  console.log(bold('\nGitalk proxy — deploy to Tencent CloudBase\n'))

  step(1, 'Reading configuration')
  const envFile = join(WORKER_DIR, '.env')
  if (!existsSync(envFile)) die(`No .env at ${envFile}`)

  const env = readEnvFile(envFile)
  ok(`loaded ${Object.keys(env).length} keys from packages/proxy-worker/.env`)

  const missing = REQUIRED.filter(([key]) => !env[key]?.trim()).map(([key, hint]) => `${key} (${hint})`)
  if (missing.length) {
    console.error(`\n${red('✗')} missing configuration:\n`)
    for (const item of missing) console.error(`    • ${item}`)
    console.error('')
    process.exit(1)
  }

  const privateKey = resolvePrivateKey(env)
  ok(`private key resolved (${privateKey.length} chars, single-line)`)

  // The CLI interpolates `{{env.X}}` from a local `.env*`; writing it here keeps
  // the committed cloudbaserc.json free of secrets.
  const deployEnv = { ...env, GITHUB_APP_PRIVATE_KEY: privateKey }
  const localEnvPath = join(PKG_DIR, '.env')
  writeFileSync(
    localEnvPath,
    Object.entries(deployEnv)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n',
    { mode: 0o600 }
  )
  ok(`wrote ${localEnvPath.replace(REPO_ROOT + '/', '')} for template interpolation ${dim('(git-ignored)')}`)

  step(2, 'Building the function bundle')
  const build = await run('pnpm', ['--filter', '@gitalk/proxy-node', 'run', 'build'], REPO_ROOT)
  if (build.code !== 0) {
    console.error(build.stdout)
    console.error(build.stderr)
    die('build failed')
  }
  const bundle = join(PKG_DIR, 'functions/gitalk-proxy/server.js')
  writeFileSync(bundle, readFileSync(join(REPO_ROOT, 'packages/proxy-node/dist/server.js')))
  ok(`functions/gitalk-proxy/server.js ${dim(`(${readFileSync(bundle).length} bytes)`)}`)

  const tcb = tcbBinary()
  if (!tcb) die('tcb not found — run `pnpm install` first.')

  step(3, 'Authenticating')
  const login = await run(
    tcb,
    ['login', '--apiKeyId', env.CLOUDBASE_SECRET_ID.trim(), '--apiKey', env.CLOUDBASE_SECRET_KEY.trim()],
    PKG_DIR
  )
  if (login.code !== 0) {
    console.error(login.stdout)
    console.error(login.stderr)
    die('CloudBase login failed — check CLOUDBASE_SECRET_ID / CLOUDBASE_SECRET_KEY.')
  }
  ok('logged in with the configured sub-account credentials')

  step(4, 'Deploying')
  // --force 是必需的：不带它时，对已存在的函数 `tcb fn deploy` 会报告成功但什么都不做
  // （实测：函数 UpdateTime 不变，新增的 envVariables 也不会被写入）。
  const deploy = await run(tcb, ['fn', 'deploy', 'gitalk-proxy', '--force', '--json'], PKG_DIR)
  const output = `${deploy.stdout}${deploy.stderr}`
  if (deploy.code !== 0 || /"error"/.test(output)) {
    console.error(output)
    die('deploy failed.')
  }
  ok(`deployed gitalk-proxy to ${env.CLOUDBASE_ENV_ID.trim()}`)

  step(5, 'Endpoint')
  const publicOrigin = env.PUBLIC_ORIGIN?.trim()
  if (publicOrigin) {
    ok(`public origin: ${publicOrigin}`)
    console.log(
      `    Health check:  curl ${publicOrigin}/\n` +
        `    OAuth 回调需要指向 ${publicOrigin}/oauth/callback\n`
    )
  } else {
    warn('PUBLIC_ORIGIN is not set — the function will fall back to the forwarded host,')
    warn('and OAuth redirects may point at an address visitors cannot reach.')
  }
  console.log(bold(green('Done.\n')))
}

main().catch((err) => {
  console.error(`\n${red('✗')} ${err.stack ?? err.message}\n`)
  process.exit(1)
})
