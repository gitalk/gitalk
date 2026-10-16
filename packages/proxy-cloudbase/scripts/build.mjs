/**
 * Bundle the shared endpoint into the CloudBase function directory.
 *
 * The function code is byte-for-byte the same artifact the container target
 * runs — `packages/proxy-node` builds it — so there is no second copy of the
 * endpoint to keep in sync. All this does is place it where `scf_bootstrap`
 * expects to find it.
 */
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG_DIR = resolve(HERE, '..')
const REPO_ROOT = resolve(PKG_DIR, '../..')
const NODE_PKG = join(REPO_ROOT, 'packages/proxy-node')
const FUNCTION_DIR = join(PKG_DIR, 'functions/gitalk-proxy')

function run(command, args, cwd) {
  return new Promise((done, failCb) => {
    const child = spawn(command, args, { cwd, stdio: 'inherit' })
    child.on('close', (code) => (code === 0 ? done() : failCb(new Error(`${command} exited ${code}`))))
  })
}

export async function build() {
  // Delegates to the container package so both targets share one build.
  await run('pnpm', ['--filter', '@gitalk/proxy-node', 'run', 'build'], REPO_ROOT)

  const built = join(NODE_PKG, 'dist/server.js')
  if (!existsSync(built)) throw new Error(`expected build output at ${built}`)

  mkdirSync(FUNCTION_DIR, { recursive: true })
  copyFileSync(built, join(FUNCTION_DIR, 'server.js'))
  return join(FUNCTION_DIR, 'server.js')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = await build()
  console.log(`  server.js -> ${out.replace(REPO_ROOT + '/', '')}`)
}
