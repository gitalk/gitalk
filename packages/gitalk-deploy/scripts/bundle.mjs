#!/usr/bin/env node
/**
 * Assemble the deploy templates the CLI ships.
 *
 * The CLI has to work from `npx github:gitalk/deploy`, with no checkout of this
 * repository anywhere — so it cannot point wrangler or tcb at the proxy source.
 * Both proxies are therefore bundled into self-contained artifacts here:
 *
 *   templates/worker/index.js     the whole Cloudflare worker, proxy-core included
 *   templates/worker/wrangler.toml
 *   templates/cloudbase/          the CloudBase function bundle
 *
 * Re-run whenever the proxy changes; CI runs it before publishing.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG = resolve(HERE, '..')
const REPO = resolve(PKG, '../..')
const TEMPLATES = join(PKG, 'templates')

const log = (message) => console.log(`  ${message}`)

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: 'inherit' })
}

rmSync(TEMPLATES, { recursive: true, force: true })

// ---------------------------------------------------------------- cloudflare
log('bundling the Cloudflare worker…')
mkdirSync(join(TEMPLATES, 'worker'), { recursive: true })
run(
  join(REPO, 'node_modules/.bin/esbuild'),
  [
    join(REPO, 'packages/proxy-worker/src/index.ts'),
    '--bundle',
    '--format=esm',
    '--platform=neutral',
    '--target=es2022',
    '--outfile=index.js'
  ],
  join(TEMPLATES, 'worker')
)

// `main` points at the bundle rather than the source; everything else is kept
// from the real config so wrangler behaves the same way it does here.
const source = readFileSync(join(REPO, 'packages/proxy-worker/wrangler.toml'), 'utf8')
writeFileSync(
  join(TEMPLATES, 'worker/wrangler.toml'),
  source.replace(/^main\s*=.*$/m, 'main = "./index.js"'),
  'utf8'
)
log('  templates/worker ✓')

// ----------------------------------------------------------------- cloudbase
log('building the CloudBase function…')
run('node', ['scripts/build.mjs'], join(REPO, 'packages/proxy-cloudbase'))
cpSync(
  join(REPO, 'packages/proxy-cloudbase/functions/gitalk-proxy'),
  join(TEMPLATES, 'cloudbase'),
  { recursive: true }
)
cpSync(join(REPO, 'packages/proxy-cloudbase/cloudbaserc.json'), join(TEMPLATES, 'cloudbaserc.json'))
log('  templates/cloudbase ✓')

const size = (path) => `${(readFileSync(path).byteLength / 1000).toFixed(1)} kB`
log(`worker bundle: ${size(join(TEMPLATES, 'worker/index.js'))}`)
