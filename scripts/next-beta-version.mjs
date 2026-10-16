#!/usr/bin/env node
/**
 * Compute the next unpublished version on a prerelease line.
 *
 * The repo pins `2.0.0-beta.0` in each `packages/<pkg>/package.json` as a
 * *baseline*: that line is where 2.0 iterates, and every release lands on the next
 * unused `2.0.0-beta.N` instead of drifting into 2.1/2.2. The counter cannot be
 * derived from git history or from the pinned baseline, so it comes from the
 * registry: take the highest `2.0.0-beta.N` already published and add one; if
 * nothing on that line is published yet, the baseline itself is the answer.
 *
 * Several packages (`--dir` repeated) share **one** N. Computing per package
 * drifts: whichever package is already published at a number the others have not
 * reach drags the line up for itself alone, and the next run publishes two
 * different versions of what is meant to be one release. So the counter is
 * `max` over *every* participating package's published versions, plus one. The
 * first package (in practice `packages/core`, which the other two depend on) is
 * the one whose baseline is read.
 *
 * Because the answer depends on network state, failures must be loud. An
 * unreachable registry or an unparseable response exits non-zero rather than
 * falling back to "0" — publishing a version that is already taken (or older
 * than what is out there) is far worse than a red build.
 *
 * Also accepts non-prerelease versions, which are echoed back unchanged so the
 * caller can use one code path for both.
 *
 * Usage:
 *   node scripts/next-beta-version.mjs --dir packages/core
 *   node scripts/next-beta-version.mjs --dir packages/core --dir packages/react --dir packages/vue
 *   node scripts/next-beta-version.mjs --name @aifire/gitalk --base 2.0.0-beta.0
 *   node scripts/next-beta-version.mjs --base 2.0.0-beta.0 --versions-file fixture.json
 *   npm view @aifire/gitalk versions --json | node scripts/next-beta-version.mjs --base 2.0.0-beta.0 --versions-file -
 *
 * The next version goes to stdout and nothing else, so `$(...)` is safe.
 * Diagnostics go to stderr.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PRERELEASE_RE = /^(\d+\.\d+\.\d+)-(.+)$/

const USAGE = `
用法：node scripts/next-beta-version.mjs [选项]

  算出下一个未发布的预发布版本号（如 2.0.0-beta.3），打印到 stdout。
  给多个 --dir 时只算**一个** N，这些包共用 —— 逐包各算会发散。
  非预发布版本（不含 "-"）原样返回，方便调用方只写一条分支。

选项：
  --dir <路径>              从 <路径>/package.json 读 name 与 version（基线）。
                            可重复；重复时这些包共用同一个版本号。
  --name <包名>             显式指定包名。可重复（全部用 --name 时），
                            或给唯一的那个 --dir 改名；不能与多个 --dir 同用。
  --base <版本>             显式指定基线版本，覆盖 package.json 里的 version
  --versions-file <路径|->  不调用 npm，改从文件或 stdin 读版本列表（离线测试用）。
                            可以是单个列表（所有包共用这一份数据，单包时不用再给
                            --dir/--name），也可以是
                            {"@aifire/gitalk": [...], "@aifire/gitalk-react": [...]}；
                            后者缺了某个包就算失败，不会当成「一个都没发过」。
  -h, --help                显示本帮助

退出码：
  0  成功（版本号在 stdout）
  1  查询或解析失败：npm 报错、JSON 无法解析、返回结构不是版本列表
  2  参数错误，或参与发布的包基线不一致

示例：
  node scripts/next-beta-version.mjs --dir packages/core
  node scripts/next-beta-version.mjs --dir packages/core --dir packages/react --dir packages/vue
  node scripts/next-beta-version.mjs --base 2.0.0-beta.0 --versions-file /tmp/versions.json
  echo '["2.0.0-beta.0","2.0.0-beta.1"]' | node scripts/next-beta-version.mjs --base 2.0.0-beta.0 --versions-file -
`

function fail(message, code = 1) {
  console.error(`\n✗ ${message}\n`)
  process.exit(code)
}

function parseArgs(argv) {
  const options = { dirs: [], names: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--dir':
      case '--name':
      case '--base':
      case '--versions-file': {
        const value = argv[++i]
        if (value === undefined || value.startsWith('--')) {
          fail(`${arg} 需要一个值`, 2)
        }
        if (arg === '--dir') options.dirs.push(value)
        else if (arg === '--name') options.names.push(value)
        else if (arg === '--base') options.base = value
        else options.versionsFile = value
        break
      }
      case '-h':
      case '--help':
        options.help = true
        break
      default:
        fail(`未知参数 ${arg}\n${USAGE}`, 2)
    }
  }
  return options
}

/** Read a package.json, for --dir. */
function readManifest(dir) {
  const path = resolve(process.cwd(), dir, 'package.json')
  if (!existsSync(path)) fail(`找不到 ${path}`, 2)
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`${path} 不是合法的 JSON：${error.message}`, 2)
  }
}

/**
 * Resolve the ordered list of packages that must share one version.
 *
 * `--dir` (repeatable) is the normal form: name and version come from each
 * manifest. `--name` exists for callers with no manifest to read; it is either
 * repeated (every package named explicitly, each still needing --base) or used
 * once to rename the single --dir's package — which is how the original
 * single-package call spelled "this name, that manifest's baseline".
 */
function resolvePackages(options) {
  const packages = options.dirs.map((dir) => {
    const manifest = readManifest(dir)
    if (!manifest.name) fail(`${dir}/package.json 里没有 name。`, 2)
    if (!manifest.version) fail(`${dir}/package.json 里没有 version（基线）。`, 2)
    return { dir, name: manifest.name, base: manifest.version }
  })

  if (options.names.length) {
    if (packages.length === 0) {
      for (const name of options.names) packages.push({ name, base: undefined })
    } else if (options.names.length === 1 && packages.length === 1) {
      packages[0] = { ...packages[0], name: options.names[0] }
    } else {
      fail(
        `--name 只能：单独用（可重复），或给唯一一个 --dir 改名；` +
          `收到 ${options.dirs.length} 个 --dir、${options.names.length} 个 --name。\n${USAGE}`,
        2
      )
    }
  }

  if (!packages.length) {
    if (options.base !== undefined && options.versionsFile !== undefined) {
      // 老用法：`npm view <pkg> versions --json | … --base X --versions-file -`。
      // 版本名单是调用方喂进来的，包名在这条路径上没有用武之地。
      packages.push({ name: '(versions-file)', base: options.base, anonymous: true })
    } else {
      fail(`缺少包：给 --dir <路径>（可重复），或 --name <包名>。\n${USAGE}`, 2)
    }
  }

  for (const pkg of packages) {
    if (options.base !== undefined) pkg.base = options.base
    if (!pkg.base) {
      fail(`缺少 ${pkg.name} 的基线版本：给 --base，或用 --dir 指向一个 package.json。\n${USAGE}`, 2)
    }
  }

  // 共用同一个版本号的前提是基线相同。基线漂了说明有人单独改过某个包：这时静默
  // 按第一个包覆盖，会让仓库里声明的版本和发出去的版本对不上，宁可当场失败。
  const distinct = new Set(packages.map((pkg) => pkg.base))
  if (distinct.size > 1) {
    fail(
      `参与发布的包基线不一致，无法共用同一个版本号：\n` +
        packages.map((pkg) => `    ${pkg.name} = ${pkg.base}`).join('\n') +
        `\n  先让它们钉在同一条基线上再发。`,
      2
    )
  }

  return packages
}

/** Turn a parsed JSON value into a validated array of version strings. */
function toVersionList(parsed, source, raw) {
  // `npm view <pkg> versions --json` returns a bare string when the package has
  // exactly one version and an array otherwise; anything else is a surprise.
  const list = typeof parsed === 'string' ? [parsed] : parsed
  if (!Array.isArray(list)) {
    fail(
      `来自 ${source} 的版本列表不是字符串或数组，而是 ${parsed === null ? 'null' : typeof parsed}。\n` +
        `  原始内容前 200 字符：${JSON.stringify(String(raw).slice(0, 200))}`
    )
  }

  const versions = list.filter((v) => typeof v === 'string')
  if (versions.length !== list.length) {
    fail(`来自 ${source} 的版本列表里有非字符串条目，拒绝猜测。`)
  }
  return versions
}

/**
 * Load `--versions-file` once (stdin can only be read once).
 *
 * A bare list is shared by every queried package; an object is keyed by package
 * name for multi-package offline tests.
 */
function loadVersionFile(path) {
  const source = path === '-' ? 'stdin' : path

  let raw
  try {
    raw = readFileSync(path === '-' ? 0 : path, 'utf8')
  } catch (error) {
    fail(`读不到版本列表来源 ${source}：${error.message}`)
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    fail(
      `无法解析来自 ${source} 的版本列表（不是合法 JSON）：${error.message}\n` +
        `  原始内容前 200 字符：${JSON.stringify(String(raw).slice(0, 200))}`
    )
  }

  if (Array.isArray(parsed) || typeof parsed === 'string') {
    return { shared: toVersionList(parsed, source, raw) }
  }
  if (parsed && typeof parsed === 'object') {
    const byName = {}
    for (const [name, value] of Object.entries(parsed)) {
      byName[name] = toVersionList(value, `${source} → ${name}`, raw)
    }
    return { byName }
  }
  fail(
    `来自 ${source} 的版本列表不是字符串、数组或「包名 → 列表」的对象，而是 ` +
      `${parsed === null ? 'null' : typeof parsed}。\n` +
      `  原始内容前 200 字符：${JSON.stringify(String(raw).slice(0, 200))}`
  )
}

/**
 * Fetch the published version list from the registry.
 *
 * An empty array means "nothing on npm yet". A 404 is that case rather than an
 * error: a package's first release has no registry entry to look up (the
 * workflow has a bootstrap path for exactly this). Every other failure — network
 * down, auth, 5xx, garbage — throws.
 */
function publishedVersions(name) {
  const source = `npm view ${name} versions --json`
  let raw
  try {
    raw = execFileSync('npm', ['view', name, 'versions', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  } catch (error) {
    const stderr = String(error.stderr ?? '')
    if (/E404|404 Not Found|is not in this registry/i.test(stderr)) {
      console.error(`⚠ npm 上没有 ${name}（E404），按「一个都没发过」处理。`)
      return []
    }
    fail(
      `查询 npm 失败：${source}\n` +
        `  退出码：${error.status ?? '(未知)'}\n` +
        `  stderr：${stderr.trim().slice(-600) || '(空)'}\n` +
        `  不会退回基线版本号 —— 网络或 registry 状态不明时发错版本比构建失败更糟。`
    )
  }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    fail(
      `无法解析来自 ${source} 的版本列表（不是合法 JSON）：${error.message}\n` +
        `  原始内容前 200 字符：${JSON.stringify(String(raw).slice(0, 200))}`
    )
  }
  return toVersionList(parsed, source, raw)
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Given a baseline and what is published, pick the next version.
 *
 * Pre-release: the baseline `2.0.0-beta.0` splits into the line `2.0.0-beta`
 * and a counter. Published versions matching `2.0.0-beta.<N>` — from **every**
 * participating package — give the highest N in use; the shared next release is
 * N+1. Nothing published on the line (or nothing at all) means the baseline
 * counter is used as-is. The baseline counter is a floor, so a manifest ahead of
 * the registry can never be walked backwards.
 *
 * Release (no `-`): returned unchanged; skip/republish decisions stay with the
 * caller, where they can also be made against the registry.
 */
function nextVersion(base, packages) {
  const match = base.match(PRERELEASE_RE)
  if (!match) {
    console.error(`· ${base} 不是预发布版本，原样返回（调用方保留「已发布则跳过」逻辑）。`)
    return base
  }

  const [, core, prerelease] = match
  const counterMatch = prerelease.match(/^(.*)\.(\d+)$/)
  const line = `${core}-${counterMatch ? counterMatch[1] : prerelease}`
  const baseCounter = counterMatch ? Number(counterMatch[2]) : 0

  const published = new RegExp(`^${escapeRegExp(line)}\\.(\\d+)$`)
  let highest = undefined

  for (const pkg of packages) {
    const counters = pkg.versions
      .map((version) => version.match(published))
      .filter(Boolean)
      .map((m) => Number(m[1]))
    const top = counters.length ? Math.max(...counters) : undefined
    console.error(
      `· ${pkg.name}：已发布 ${pkg.versions.length} 个版本，同基线（${line}.N）的有 ${counters.length} 个` +
        (top === undefined ? '' : `，最大 N = ${top}`)
    )
    if (top !== undefined) highest = highest === undefined ? top : Math.max(highest, top)
  }

  const nextCounter = highest === undefined ? baseCounter : Math.max(baseCounter, highest + 1)

  if (highest === undefined) {
    console.error(`· ${packages.length} 个包在同基线上一个都没发过 → 用基线 ${line}.${nextCounter}`)
  } else {
    console.error(`· 同基线最大 N = ${highest} → 本次发布 ${line}.${nextCounter}（${packages.length} 个包共用）`)
  }
  return `${line}.${nextCounter}`
}

const options = parseArgs(process.argv.slice(2))
if (options.help) {
  console.log(USAGE.trim())
  process.exit(0)
}

const packages = resolvePackages(options)
const fileSource = options.versionsFile === undefined ? undefined : loadVersionFile(options.versionsFile)

for (const pkg of packages) {
  if (!fileSource) {
    pkg.versions = publishedVersions(pkg.name)
  } else if (fileSource.shared) {
    pkg.versions = fileSource.shared
  } else if (pkg.anonymous) {
    fail(
      `版本源是「包名 → 列表」的对象，得用 --dir 或 --name 指出要算哪些包。\n` +
        `  源里有：${Object.keys(fileSource.byName).join('、') || '(空)'}`
    )
  } else if (pkg.name in fileSource.byName) {
    pkg.versions = fileSource.byName[pkg.name]
  } else {
    fail(
      `版本源里没有 ${pkg.name}：只有 ${Object.keys(fileSource.byName).join('、') || '(空)'}。\n` +
        `  不会把它当成「一个都没发过」—— 那会让已经发出去的版本号再发一次。`
    )
  }
}

process.stdout.write(`${nextVersion(packages[0].base, packages)}\n`)
