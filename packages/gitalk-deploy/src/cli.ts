#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { COMMON, missing, parseEnvFile } from './env.js'

const USAGE = `gitalk-deploy — deploy the Gitalk proxy

  gitalk-deploy -c <env-file> -t <target>

Options
  -c, --config <file>   dotenv file holding the App credentials (required)
  -t, --target <name>   cloudflare | cloudbase
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

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '-h' || arg === '--help') {
      console.log(USAGE)
      return
    }
    if (arg === '-c' || arg === '--config') config = argv[++i]
    else if (arg === '-t' || arg === '--target') target = argv[++i]
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
  console.log('  next: deployment is not wired up yet in this build')
}

main(process.argv.slice(2))
