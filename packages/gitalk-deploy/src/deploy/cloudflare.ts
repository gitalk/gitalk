import { spawn } from 'node:child_process'

/** Everything the Cloudflare deploy needs, already validated by the CLI. */
export interface CloudflarePlan {
  /** Directory holding the bundled worker and its wrangler.toml. */
  readonly templateDir: string
  /** Secret names to upload; values come from `env`, never from argv. */
  readonly secrets: readonly string[]
  readonly env: Record<string, string>
  /** Print the steps instead of running them. */
  readonly dryRun: boolean
}

const log = (message: string) => console.log(`  ${message}`)

/**
 * Deploy the worker to Cloudflare.
 *
 * Secrets are pushed with `wrangler secret put`, reading each value from the
 * environment rather than passing it on the command line — argv is visible to
 * any process on the machine, and these are the App credentials.
 */
export async function deployCloudflare(plan: CloudflarePlan): Promise<string> {
  const { templateDir, secrets, env, dryRun } = plan
  const childEnv = { ...process.env, CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN }

  // `execFile` has no stdin support, and `secret put` reads the value from
  // stdin — with execFile it would wait forever. Spawn and write explicitly.
  const wrangler = (args: string[], input?: string) =>
    new Promise<string>((resolve, reject) => {
      const child = spawn('npx', ['--yes', 'wrangler@4', ...args], {
        cwd: templateDir,
        env: childEnv
      })
      let out = ''
      let err = ''
      child.stdout.on('data', (chunk) => (out += String(chunk)))
      child.stderr.on('data', (chunk) => (err += String(chunk)))
      child.on('error', reject)
      child.on('close', (code) =>
        code === 0 ? resolve(out) : reject(new Error(err.trim() || `wrangler exited ${code}`))
      )
      child.stdin.end(input ?? '')
    })

  log(`worker: ${templateDir}`)
  log(`${secrets.length} secrets, ${dryRun ? 'dry run' : 'uploading'}`)

  for (const name of secrets) {
    if (dryRun) {
      log(`  would set ${name}`)
      continue
    }
    // The value goes through stdin: `secret put` reads it from there, which
    // keeps it out of the process list and out of any shell history.
    await wrangler(['secret', 'put', name], `${env[name] ?? ''}\n`)
    log(`  set ${name}`)
  }

  if (dryRun) {
    log('  would run: wrangler deploy')
    return ''
  }

  const stdout = await wrangler(['deploy'])
  const url = /https:\/\/[A-Za-z0-9.-]+\.workers\.dev/.exec(stdout)?.[0] ?? ''
  if (!url) {
    log('deployed, but the URL was not in the output — check the Cloudflare dashboard')
    return ''
  }
  log(`deployed: ${url}`)
  return url
}

/** Ask the deployed worker whether it is configured and reachable. */
export async function checkHealth(baseUrl: string): Promise<boolean> {
  if (!baseUrl) return false
  try {
    // The proxy answers its identity at `/`; there is no `/health` route.
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/`, {
      signal: AbortSignal.timeout(15_000)
    })
    if (!response.ok) return false
    const body = (await response.json()) as { ok?: boolean; service?: string }
    return body.ok === true && body.service === 'gitalk-proxy'
  } catch {
    return false
  }
}
