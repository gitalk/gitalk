import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Everything the CloudBase deploy needs, already validated by the CLI. */
export interface CloudbasePlan {
  /** Directory holding cloudbaserc.json and the function bundle. */
  readonly templateDir: string
  /** Runtime variables, written to a local .env for `{{env.X}}` interpolation. */
  readonly runtime: Record<string, string>
  readonly env: Record<string, string>
  readonly dryRun: boolean
}

const log = (message: string) => console.log(`  ${message}`)

/**
 * Run a `tcb` subcommand.
 *
 * Same reasoning as the Cloudflare path: credentials go through argv only where
 * the CLI offers no other channel, and never through a shell string.
 */
function tcb(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['--yes', '@cloudbase/cli@latest', ...args], {
      cwd,
      env: process.env
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk) => (out += String(chunk)))
    child.stderr.on('data', (chunk) => (err += String(chunk)))
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(err.trim() || `tcb exited ${code}`))
    )
    child.stdin.end()
  })
}

/**
 * Deploy the HTTP function to CloudBase.
 *
 * CloudBase cannot take its runtime configuration on the command line: the
 * function's environment comes from `{{env.X}}` placeholders in
 * `cloudbaserc.json`, interpolated from a `.env` beside it. That file is written
 * here, from the same values already validated, and removed afterwards.
 */
export async function deployCloudbase(plan: CloudbasePlan): Promise<string> {
  const { templateDir, runtime, env, dryRun } = plan
  const envId = env.CLOUDBASE_ENV_ID
  const base = `https://${envId}.service.tcloudbase.com`
  const functionName = 'gitalk-proxy'

  log(`function: ${functionName} in ${envId}`)
  log(`${Object.keys(runtime).length} runtime variables`)

  if (dryRun) {
    log(`  would log in with CLOUDBASE_SECRET_ID / CLOUDBASE_SECRET_KEY`)
    log(`  would write .env beside cloudbaserc.json`)
    log(`  would run: tcb fn deploy ${functionName} --force --envId ${envId}`)
    log(`  would check ${base}/health`)
    return ''
  }

  // Non-interactive login: the API keys stand in for the browser flow.
  await tcb(
    ['login', '--apiKeyId', env.CLOUDBASE_SECRET_ID ?? '', '--apiKey', env.CLOUDBASE_SECRET_KEY ?? ''],
    templateDir
  )
  log('  logged in')

  // `{{env.X}}` is resolved from this file at deploy time.
  writeFileSync(
    join(templateDir, '.env'),
    Object.entries(runtime)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n') + '\n',
    { mode: 0o600 }
  )

  await tcb(['fn', 'deploy', functionName, '--force', '--envId', envId], templateDir)
  log(`  deployed: ${base}`)
  return base
}
