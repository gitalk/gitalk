#!/usr/bin/env node
/**
 * Verify that every file a published package promises actually exists.
 *
 * `exports` is how Node resolves entry points, and nothing validates it at
 * build time: a typo or a renamed build artefact ships a package whose
 * `import` fails for every consumer, while CI stays green because the build
 * itself succeeded. That happened here once (`style.css` pointed at a
 * `core.css` the bundler never emitted), so it is checked before publishing.
 *
 * Run after `pnpm build`. Exits non-zero listing every missing target.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Packages that get published. Private ones are skipped by design. */
const PACKAGES = ['packages/core', 'packages/react', 'packages/vue']

/** Flatten a package.json `exports` value into its string targets. */
function targetsOf(exports) {
  const found = []
  const walk = (value) => {
    if (typeof value === 'string') found.push(value)
    else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(exports)
  return found
}

const problems = []

for (const dir of PACKAGES) {
  const manifestPath = join(REPO_ROOT, dir, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))

  if (manifest.private) {
    problems.push(`${dir}: marked private but listed as publishable`)
    continue
  }

  if (!manifest.publishConfig?.access) {
    // A scoped package defaults to restricted, and publishing one fails
    // outright on a free account.
    problems.push(`${dir}: missing publishConfig.access`)
  }

  const declared = [
    ...['main', 'module', 'types'].map((key) => [key, manifest[key]]),
    ...targetsOf(manifest.exports).map((value) => ['exports', value])
  ].filter(([, value]) => typeof value === 'string')

  const missing = declared.filter(([, value]) => {
    // `./package.json` is always present by definition.
    if (value === './package.json') return false
    return !existsSync(resolve(REPO_ROOT, dir, value))
  })

  if (missing.length) {
    for (const [key, value] of missing) {
      problems.push(`${manifest.name}: ${key} -> ${value} does not exist`)
    }
  } else {
    console.log(`  ✓ ${manifest.name} (${declared.length} 个入口点)`)
  }
}

if (problems.length) {
  console.error('\n✗ 发布前校验失败：\n')
  for (const problem of problems) console.error(`    ${problem}`)
  console.error('\n  路径相对各包目录。先跑 `pnpm build`，或修正 package.json 的声明。\n')
  process.exit(1)
}

console.log('\n  所有发布入口点都存在。\n')
