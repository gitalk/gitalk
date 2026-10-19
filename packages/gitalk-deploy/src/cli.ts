#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkHealth, deployCloudflare } from './deploy/cloudflare.js'
import { deployCloudbase } from './deploy/cloudbase.js'
import { COMMON, missing, parseEnvFile } from './env.js'

const USAGE = `gitalk-deploy — deploy the Gitalk proxy

  gitalk-deploy -c <env-file> -t <target>

Options
  -c, --config <file>   dotenv file holding the App credentials (required)
  -t, --target <name>   cloudflare | cloudbase
  -n, --dry-run         print the steps without running them
  -h, --help            this message
`

const PLATFORM: Record<string, { required: readonly { key: string; hint: string }[] }> = {
  cloudflare: {
    required: [
      ...COMMON,
      { key: 'CLOUDFLARE_API_TOKEN', hint: 'an API token with Workers Scripts: Edit' }
    ]
  },
  cloudbase: {
    required: [
      ...COMMON,
      { key: 'CLOUDBASE_ENV_ID', hint: 'the CloudBase environment id' },
      { key: 'CLOUDBASE_SECRET_ID', hint: 'a Tencent Cloud SecretId (use a sub-account)' },
      { key: 'CLOUDBASE_SECRET_KEY', hint: 'the matching SecretKey' }
    ]
  }
}

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

function main(argv: string[]): void {
  let config: string | undefined
  let target: string | undefined
  let dryRun = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') {
      console.log(USAGE)
      return
    }
    if (arg === '-c' || arg === '--config') config = argv[++i]
    else if (arg === '-t' || arg === '--target') target = argv[++i]
    else if (arg === '-n' || arg === '--dry-run') dryRun = true
    else fail(`unknown argument: ${arg}\n${USAGE}`)
  }

  if (!config) fail(`missing -c <env-file>\n${USAGE}`)
  if (!target) fail(`missing -t <target>\n${USAGE}`)
  const platform = PLATFORM[target]
  if (!platform) fail(`unknown target "${target}" — expected cloudflare or cloudbase`)
  if (!existsSync(config)) fail(`no such file: ${config}`)

  const env = parseEnvFile(config)
  const gaps = missing(env, platform.required)
  if (gaps.length) {
    fail(
      `${gaps.length} required value(s) missing from ${config}:\n` +
        gaps.map((g) => `  ${g.key}  — ${g.hint}`).join('\n')
    )
  }

  console.log(`✓ ${config} has every value ${target} needs`)

  // The templates sit beside the built CLI, wherever npx unpacked it.
  const here = dirname(fileURLToPath(import.meta.url))
  const templates = join(here, '..', 'templates')

  const required = existsSync(join(templates, 'worker', 'index.js'))

  if (target === 'cloudbase') {
    if (!existsSync(join(templates, 'functions/gitalk-proxy'))) {
      fail(
        `no CloudBase bundle at ${join(templates, 'functions/gitalk-proxy')} — rebuild with scripts/bundle.mjs`
      )
    }
    deployCloudbase({
      templateDir: templates,
      // `{{env.X}}` reads these from the .env written beside cloudbaserc.json;
      // the Tencent Cloud keys are for the CLI itself and are excluded.
      runtime: Object.fromEntries(
        (platform.required as readonly { key: string }[])
          .map((v) => v.key)
          .filter((key) => !key.startsWith('CLOUDBASE_'))
          .map((key) => [key, env[key] ?? ''])
      ),
      env,
      dryRun
    })
      .then(async (url) => {
        if (dryRun) {
          console.log('\n✓ dry run complete — rerun without -n to deploy')
          return
        }
        if (await checkHealth(url)) {
          console.log(`\n✓ healthy: ${url}`)
        } else {
          console.log('\n⚠ deployed, but /health did not answer ok — check the function logs')
        }
      })
      .catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)))
    return
  }

  if (!required) {
    fail(
      `no worker bundle at ${join(templates, 'worker')}\n` +
        '  this build was packaged without templates — rebuild with scripts/bundle.mjs'
    )
  }

  deployCloudflare({
    templateDir: join(templates, 'worker'),
    // Everything except the Cloudflare credential itself becomes a worker secret.
    secrets: platform.required.map((v) => v.key).filter((key) => key !== 'CLOUDFLARE_API_TOKEN'),
    env,
    dryRun
  })
    .then(async (url) => {
      if (dryRun) {
        console.log('\n✓ dry run complete — rerun without -n to deploy')
        return
      }
      if (await checkHealth(url)) {
        console.log(`\n✓ healthy: ${url}`)
        console.log(`  set proxy: '${url}' in your Gitalk options`)
      } else {
        console.log('\n⚠ deployed, but /health did not answer ok — check the worker logs')
      }
    })
    .catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)))
}

main(process.argv.slice(2))
