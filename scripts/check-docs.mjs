#!/usr/bin/env node
/**
 * Check that the setup steps still live in exactly one place.
 *
 * The single source of truth is `packages/gitalk-deploy/README.md` and its
 * Chinese twin `README-CN.md`. Everything else — the two root READMEs,
 * `docs/guide.md`, `docs/handsoff.md`, and the eleven landing-page dictionaries
 * — is supposed to summarise and link, never to restate.
 *
 * This script fails when that stops being true:
 *
 *   1. the two truth sources have the same number of steps, in the same order,
 *      and both contain the facts a setup needs (install URL, permissions,
 *      env vars, callback timing);
 *   2. every `npx github:gitalk/deploy …` command in any document is byte-for-byte
 *      one of the commands the truth source publishes;
 *   3. every locale's `getStarted` has exactly one bullet per truth-source step
 *      (five), each short, with at most one code block (the deploy command), and
 *      the same order as the README: App, deploy, repository, install, embed —
 *      plus no claim that contradicts the callback-URL order;
 *   4. every relative markdown link resolves, and every document that should
 *      link to the truth source actually does;
 *   5. the landing page's "more" link points at the truth source.
 *
 * Run it with `node scripts/check-docs.mjs`. It reads files only; no network,
 * no writes outside `node_modules/.cache`.
 */

import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// `node scripts/check-docs.mjs | head` should not print an EPIPE stack trace.
process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0)
  throw error
})

const TRUTH_EN = 'packages/gitalk-deploy/README.md'

/**
 * The truth source has exactly this many steps. Pinned here on purpose: if
 * someone shrinks both the README and the landing page together, the "same
 * count" comparison below would still pass, so the absolute number is asserted
 * as well.
 */
const EXPECTED_STEPS = 5

/** The one concrete example both READMEs must keep using, end to end. */
const EXAMPLE_ANCHORS = [
  'My Niubi Gitalk',
  'my-niubi-gitalk',
  'octocat',
  'demo-repo',
  'my-niubi-gitalk.octocat.workers.dev'
]
const TRUTH_CN = 'packages/gitalk-deploy/README-CN.md'
const TRUTH_FILES = [TRUTH_EN, TRUTH_CN]

/** Markdown that is allowed to summarise; each must link to the truth source. */
const LINKING_DOCS = [
  { file: 'readme.md', links: [TRUTH_EN] },
  { file: 'readme-cn.md', links: [TRUTH_CN] },
  { file: 'docs/guide.md', links: [TRUTH_EN, TRUTH_CN] },
  { file: 'docs/handsoff.md', links: [TRUTH_EN, TRUTH_CN] }
]

/** Documents scanned for deploy commands. */
const COMMAND_DOCS = ['readme.md', 'readme-cn.md', 'docs/guide.md', 'docs/handsoff.md', ...TRUTH_FILES]

/** Facts both truth sources must state. Missing one means an incomplete step. */
const REQUIRED_FACTS = [
  ['personal App entry', 'https://github.com/settings/apps'],
  ['organisation App entry', 'organizations/<Org Name>/settings/apps'],
  ['install page URL', 'installations/new'],
  ['Discussions permission', 'Discussions: Read and write'],
  ['Metadata permission', 'Metadata: Read-only'],
  ['session key', 'SESSION_ENCRYPTION_KEY'],
  ['session key command', 'openssl rand -hex 32'],
  ['origin allowlist', 'GITALK_ALLOWED_ORIGINS'],
  ['private key is a .pem', '.pem'],
  ['fingerprint warning', 'SHA256'],
  ['callback failure', 'redirect_uri_mismatch'],
  ['CloudBase command', 'npx github:gitalk/deploy -c .env -t cloudbase'],
  ['Discussions feature path', 'Features → Discussions'],
  ['hosted proxy is closed', 'gitalk-proxy.aispin-abf.workers.dev'],
  ['hosted proxy reason', 'CORS']
]

/**
 * Claims that contradict the truth source: a callback URL can only be filled in
 * after the first deploy, and the overview is five steps, not four.
 */
const BANNED_STEP_CLAIMS = [
  /four steps?/i,
  /vier schritt/i,
  /cuatro pasos?/i,
  /quatre étapes?/i,
  /[4４]ステップ/,
  /네 단계|[4４]단계/,
  /cztery krok/i,
  /четыре шаг/i,
  /چهار گام/,
  /四步/,
  /四個步驟/,
  /四步驟/
]

const CALLBACK_NOW = [
  /callback[^.]{0,60}(now|already|先填|現在就|现在就|jetzt|ahora|maintenant|今すぐ|지금|teraz|сейчас)/i,
  /(now|already|先填|現在就|现在就|jetzt|ahora|maintenant|今すぐ|지금|teraz|сейчас)[^.]{0,40}callback/i
]

/** A step body longer than this is a manual, not an overview. */
const MAX_OVERVIEW_BODY = 280

/** Bullet 3 is the repository step in every language. */
const REPO_WORDS = /public|públic|عمومی/i

/** Bullet 4 is the install step in every language. */
const INSTALL_WORDS = /install|安装|安裝|インストール|설치|instal|установ|zainstal|نصب/i

const errors = []
const passes = []

const fail = (message) => errors.push(message)
const ok = (message) => passes.push(message)

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')

const squash = (value) => value.replace(/\s+/g, ' ').trim()

/** The deploy command on one line, without a trailing shell comment. */
function canonicalCommand(raw) {
  return squash(raw.split('#')[0])
}

function commandsIn(text) {
  return [...text.matchAll(/npx github:gitalk\/deploy[^\n`]*/g)].map((m) => canonicalCommand(m[0]))
}

function stepHeadings(text, kind) {
  const pattern = kind === 'en' ? /^## Step (\d+) — (.+)$/gm : /^## 第 (\d+) 步 — (.+)$/gm
  return [...text.matchAll(pattern)].map((m) => ({ number: Number(m[1]), title: m[2].trim() }))
}

function assertContiguous(file, steps) {
  if (!steps.length) {
    fail(`${file}: no step headings found`)
    return false
  }
  const numbers = steps.map((s) => s.number)
  const expected = numbers.map((_, i) => i + 1)
  if (numbers.join(',') !== expected.join(',')) {
    fail(`${file}: step numbers are ${numbers.join(',')}, expected ${expected.join(',')}`)
    return false
  }
  if (steps.some((s) => !s.title)) {
    fail(`${file}: a step heading has an empty title`)
    return false
  }
  return true
}

/**
 * One numbered step: its heading, where it starts, and the text up to the next
 * step heading (or the next `## ` section, whichever comes first).
 */
function stepBlock(text, kind, n) {
  const pattern = kind === 'en' ? /^## Step (\d+) — (.+)$/gm : /^## 第 (\d+) 步 — (.+)$/gm
  const headings = [...text.matchAll(pattern)].map((m) => ({
    number: Number(m[1]),
    title: m[2].trim(),
    start: m.index
  }))
  const hit = headings.find((heading) => heading.number === n)
  if (!hit) return null
  const nextStep = headings.find((heading) => heading.start > hit.start)
  const nextSection = text.indexOf('\n## ', hit.start + 1)
  const ends = [nextStep?.start, nextSection === -1 ? text.length : nextSection + 1].filter(
    (value) => typeof value === 'number'
  )
  const blockEnd = Math.min(...ends)
  return { ...hit, end: blockEnd, section: text.slice(hit.start, blockEnd) }
}

function checkTruthSource(kind, file) {
  let text
  try {
    text = read(file)
  } catch {
    fail(`${file}: missing — this file is the source of truth`)
    return null
  }

  const steps = stepHeadings(text, kind)
  // Report a numbering problem but keep checking: the order assertions below
  // are exactly what catches a step that was moved or swapped.
  assertContiguous(file, steps)
  if (steps.length !== EXPECTED_STEPS) {
    fail(`${file}: ${steps.length} steps, expected ${EXPECTED_STEPS}`)
  }

  for (const [label, needle] of REQUIRED_FACTS) {
    if (!text.includes(needle)) fail(`${file}: does not mention ${label} (\`${needle}\`)`)
  }
  for (const anchor of EXAMPLE_ANCHORS) {
    if (!text.includes(anchor)) {
      fail(`${file}: the worked example is missing \`${anchor}\` — keep one concrete example throughout`)
    }
  }

  const blocks = {}
  for (let n = 1; n <= EXPECTED_STEPS; n += 1) blocks[n] = stepBlock(text, kind, n)
  for (let n = 1; n <= EXPECTED_STEPS; n += 1) {
    if (!blocks[n]) fail(`${file}: step ${n} is missing`)
  }

  // Step 1 creates the App, at the account/organisation level — never in the
  // repository's settings.
  if (blocks[1]) {
    for (const [label, needle] of [
      ['the personal-account entry', 'https://github.com/settings/apps'],
      ['the organisation entry', 'organizations/<Org Name>/settings/apps']
    ]) {
      if (!blocks[1].section.includes(needle)) {
        fail(`${file}: step 1 does not show ${label} (\`${needle}\`)`)
      }
    }
    const notRepoPage =
      kind === 'en' ? "not in the repository's settings" : '不在仓库的 Settings 里'
    if (!blocks[1].section.toLowerCase().includes(notRepoPage.toLowerCase())) {
      fail(`${file}: step 1 does not say that the App is not created in the repository's settings`)
    }
    const repoLevelPath =
      kind === 'en'
        ? /repository'?s? settings[\s\S]{0,40}developer settings/i
        : /仓库[^\n]{0,20}Settings[^\n]{0,20}Developer settings/
    if (repoLevelPath.test(blocks[1].section)) {
      fail(`${file}: step 1 sends the reader to the repository's Settings → Developer settings`)
    }
    const ownership = kind === 'en' ? /organisation/i : /组织/
    if (!ownership.test(blocks[1].section)) {
      fail(`${file}: step 1 does not explain where the App can be installed`)
    }
    const appTitle = kind === 'en' ? /create the github app/i : /创建 GitHub App/
    if (!appTitle.test(blocks[1].title)) {
      fail(`${file}: step 1 is not "create the GitHub App" (found "${blocks[1].title}")`)
    }
  }

  // Step 2 deploys.
  if (blocks[2]) {
    for (const [label, needle] of [
      ['the deploy command', 'npx github:gitalk/deploy'],
      ['the callback failure', 'redirect_uri_mismatch'],
      ['the origin allowlist', 'GITALK_ALLOWED_ORIGINS'],
      ['the callback subsection', '### 2c.']
    ]) {
      if (!blocks[2].section.includes(needle)) {
        fail(`${file}: step 2 (deploy) does not mention ${label} (\`${needle}\`)`)
      }
    }
    const deployTitle = kind === 'en' ? /deploy/i : /部署/
    if (!deployTitle.test(blocks[2].title)) {
      fail(`${file}: step 2 is not the deploy step (found "${blocks[2].title}")`)
    }
  }

  // Step 3 prepares the repository.
  if (blocks[3]) {
    for (const [label, needle] of [
      ['Discussions', 'Features → Discussions'],
      ['the public requirement', 'public'],
      ['a category', 'category']
    ]) {
      if (!blocks[3].section.includes(needle)) {
        fail(`${file}: step 3 (prepare the repository) does not mention ${label} (\`${needle}\`)`)
      }
    }
    const prepTitle = kind === 'en' ? /prepare the repository/i : /准备仓库/
    if (!prepTitle.test(blocks[3].title)) {
      fail(`${file}: step 3 is not "prepare the repository" (found "${blocks[3].title}")`)
    }
  }

  // Step 4 installs.
  if (blocks[4]) {
    for (const [label, needle] of [
      ['install page URL', 'installations/new'],
      ['installation token', 'installation token'],
      ['the skipping warning', kind === 'en' ? 'Creating the App is not enough' : '只创建 App 是不够的'],
      ['the proxy log line', 'no installation found for this app']
    ]) {
      if (!blocks[4].section.includes(needle)) {
        fail(`${file}: step 4 (install) does not mention ${label} (\`${needle}\`)`)
      }
    }
    const installTitle = kind === 'en' ? /install the app/i : /安装/
    if (!installTitle.test(blocks[4].title)) {
      fail(`${file}: step 4 is not the install step (found "${blocks[4].title}")`)
    }
  }

  // Step 5 embeds the component.
  if (blocks[5]) {
    for (const [label, needle] of [
      ['clientID', 'clientID'],
      ...(kind === 'en'
        ? [['the bare repo name rule', '`repo` is the repository name alone']]
        : [['the bare repo name rule', '`repo` 只写仓库名']])
    ]) {
      if (!blocks[5].section.includes(needle)) {
        fail(`${file}: step 5 (embed) does not mention ${label} (\`${needle}\`)`)
      }
    }
    const embedTitle = kind === 'en' ? /embed the component/i : /引入组件/
    if (!embedTitle.test(blocks[5].title)) {
      fail(`${file}: step 5 is not "embed the component" (found "${blocks[5].title}")`)
    }
  }

  // The order the whole document promises: app -> deploy -> repo -> install -> embed.
  if (blocks[1] && blocks[2] && blocks[1].start > blocks[2].start) {
    fail(`${file}: the App step must come before the deploy step`)
  }
  if (blocks[2] && blocks[3] && blocks[2].start > blocks[3].start) {
    fail(`${file}: the deploy step must come before the repository step`)
  }
  if (blocks[3] && blocks[4] && blocks[3].start > blocks[4].start) {
    fail(`${file}: the repository step must come before the install step`)
  }
  if (blocks[4] && blocks[5] && blocks[4].start > blocks[5].start) {
    fail(`${file}: the install step appears after the "embed the component" step`)
  }
  const firstInstallUrl = text.indexOf('installations/new')
  if (firstInstallUrl !== -1 && blocks[4] && firstInstallUrl < blocks[4].start) {
    fail(`${file}: \`installations/new\` appears before the install step`)
  }

  // Nothing may send the reader to the repository settings to create the App.
  const repoCreatePath =
    kind === 'en'
      ? /(repository settings|settings of the repository)[\s\S]{0,40}github apps/i
      : /仓库的?\s*Settings[^\n]{0,20}GitHub Apps/
  if (repoCreatePath.test(text)) {
    fail(`${file}: suggests creating the App from the repository settings`)
  }

  // Callback URL: its own subsection, after the deploy.
  const callbackAt = text.indexOf('### 2c.')
  if (callbackAt === -1) {
    fail(`${file}: no "### 2c." callback-URL section`)
  } else if (blocks[2] && callbackAt < blocks[2].start) {
    fail(`${file}: the callback-URL section appears before step 2`)
  }
  const emptyHint = kind === 'en' ? 'leave it empty' : '先留空'
  if (!text.includes(emptyHint)) {
    fail(`${file}: step 1 does not tell the reader to leave the callback URL empty`)
  }

  return { steps, text, commands: [...new Set(commandsIn(text))] }
}

function loadDictionaries() {
  const cacheDir = join(ROOT, 'node_modules/.cache/check-docs')
  mkdirSync(cacheDir, { recursive: true })
  const outfile = join(cacheDir, 'i18n.mjs')

  const entry = join(ROOT, 'apps/landing/src/i18n.tsx')
  const candidates = [
    join(ROOT, 'packages/gitalk-deploy/node_modules/esbuild/lib/main.js'),
    join(ROOT, 'packages/proxy-node/node_modules/esbuild/lib/main.js'),
    join(ROOT, 'node_modules/esbuild/lib/main.js')
  ]

  const esbuildPath = candidates.find((candidate) => existsSync(candidate))
  if (!esbuildPath) {
    throw new Error(
      'esbuild is not installed; run `pnpm install` (the landing check bundles i18n.tsx with it)'
    )
  }

  return import(pathToFileURL(esbuildPath).href).then((esbuild) => {
    esbuild.buildSync({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      platform: 'node',
      logLevel: 'silent',
      outfile
    })
    return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`)
  })
}

function checkMarkdownLinks(file) {
  const text = read(file)
  const dir = dirname(join(ROOT, file))
  const pattern = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

  for (const match of text.matchAll(pattern)) {
    const target = match[1]
    if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue
    const path = target.split('#')[0]
    if (!path) continue
    if (!existsSync(resolve(dir, path))) {
      fail(`${file}: link target does not exist: ${target}`)
    }
  }
}

function checkLanding(truthSteps, commands) {
  return loadDictionaries().then(({ DICTS, LANGS }) => {
    const langs = Object.keys(DICTS)
    if (langs.length !== 11) fail(`landing: ${langs.length} dictionaries, expected 11`)
    if (LANGS.length !== langs.length) {
      fail(`landing: LANGS lists ${LANGS.length} languages but there are ${langs.length} dictionaries`)
    }
    if (!truthSteps) return

    for (const lang of langs) {
      const dict = DICTS[lang]
      const gs = dict.getStarted
      if (!gs) {
        fail(`landing[${lang}]: no getStarted section`)
        continue
      }

      if (gs.steps.length !== truthSteps.length) {
        fail(
          `landing[${lang}]: ${gs.steps.length} overview bullets, truth source has ${truthSteps.length} steps`
        )
        continue
      }
      ok(`landing[${lang}]: ${gs.steps.length} bullets match the truth source`)

      let coded = 0
      for (const [index, step] of gs.steps.entries()) {
        const where = `landing[${lang}] step ${index + 1}`
        if (!step.title?.trim() || !step.body?.trim()) fail(`${where}: empty title or body`)
        if (step.body.length > MAX_OVERVIEW_BODY) {
          fail(`${where}: body is ${step.body.length} chars — keep it under ${MAX_OVERVIEW_BODY}`)
        }
        if (step.code) {
          coded += 1
          if (canonicalCommand(step.code) !== commands.deploy) {
            fail(`${where}: code is not the canonical deploy command (\`${commands.deploy}\`)`)
          }
        }
        if (/callback/i.test(`${step.title} ${step.body}`) && index !== 1) {
          fail(`${where}: mentions the callback URL outside the deploy bullet`)
        }
      }
      if (coded !== 1) fail(`landing[${lang}]: expected exactly one code block, found ${coded}`)

      // Bullet order must mirror the truth source:
      // app -> deploy -> repository -> install -> embed.
      if (!/GitHub App/.test(`${gs.steps[0].title} ${gs.steps[0].body}`)) {
        fail(`landing[${lang}] step 1: does not describe creating the GitHub App`)
      }
      if (canonicalCommand(gs.steps[1].code ?? '') !== commands.deploy) {
        fail(`landing[${lang}] step 2: is not the deploy bullet (missing the command)`)
      }
      if (!REPO_WORDS.test(`${gs.steps[2].title} ${gs.steps[2].body}`)) {
        fail(`landing[${lang}] step 3: does not describe preparing the repository`)
      }
      if (!INSTALL_WORDS.test(`${gs.steps[3].title} ${gs.steps[3].body}`)) {
        fail(`landing[${lang}] step 4: does not describe installing the App`)
      }
      if (!/clientID/.test(`${gs.steps[4].title} ${gs.steps[4].body}`)) {
        fail(`landing[${lang}] step 5: does not mention clientID (the embed step)`)
      }
      const stat = dict.hero?.stats?.lines
      if (String(stat?.value) !== String(EXPECTED_STEPS)) {
        fail(`landing[${lang}]: the stats card says ${stat?.value} steps, expected ${EXPECTED_STEPS}`)
      }

      const overview = JSON.stringify({
        getStarted: gs,
        stepsStat: dict.hero?.stats?.lines,
        tabsNote: dict.tabs?.note
      })
      for (const claim of BANNED_STEP_CLAIMS) {
        if (claim.test(overview)) {
          fail(`landing[${lang}]: still claims "${claim.source}" — the overview is ${truthSteps.length} steps`)
        }
      }
      for (const claim of CALLBACK_NOW) {
        if (claim.test(overview)) {
          fail(`landing[${lang}]: says the callback URL can be set before the deploy (${claim.source})`)
        }
      }
    }

    // The "more" link: URL shape, both languages, and the files it names.
    const component = read('apps/landing/src/components/get-started.tsx')
    const base = 'https://github.com/gitalk/gitalk/blob/main/packages/gitalk-deploy'
    if (!component.includes(base)) {
      fail('landing: get-started.tsx no longer links to the deploy README base')
    }
    for (const [label, name] of [
      ['English', 'README.md'],
      ['Chinese', 'README-CN.md']
    ]) {
      if (!component.includes(`'${name}'`)) {
        fail(`landing: get-started.tsx has no ${label} branch for ${name}`)
      }
      if (!existsSync(join(ROOT, 'packages/gitalk-deploy', name))) {
        fail(`landing: the ${label} link target packages/gitalk-deploy/${name} does not exist`)
      }
    }
    if (!/step-more/.test(component)) fail('landing: get-started.tsx lost the .step-more link block')
    ok('landing: the step-more link points at the truth source, in both languages')
  })
}

async function main() {
  const en = checkTruthSource('en', TRUTH_EN)
  const cn = checkTruthSource('cn', TRUTH_CN)

  if (en && cn) {
    if (en.steps.length !== cn.steps.length) {
      fail(`truth sources differ: ${TRUTH_EN} has ${en.steps.length} steps, ${TRUTH_CN} has ${cn.steps.length}`)
    } else {
      ok(`truth sources: ${en.steps.length} steps in both languages`)
    }

    // Same commands in both languages, ignoring the trailing comment.
    const enCommands = new Set(en.commands)
    const cnCommands = new Set(cn.commands)
    for (const command of enCommands) {
      if (!cnCommands.has(command)) fail(`${TRUTH_CN}: missing command \`${command}\``)
    }
    for (const command of cnCommands) {
      if (!enCommands.has(command)) fail(`${TRUTH_EN}: missing command \`${command}\``)
    }

    // A roughly equal amount of code-fenced content: one side must not be the
    // long version while the other is a summary.
    const fences = (text) => (text.match(/^```/gm) ?? []).length
    if (fences(en.text) !== fences(cn.text)) {
      fail(
        `truth sources have different numbers of code fences (en ${fences(en.text)}, cn ${fences(cn.text)}) — keep them 1:1`
      )
    } else {
      ok('truth sources: same number of code fences')
    }
    if (en.steps.some((s) => !cn.steps[s.number - 1])) {
      fail('truth sources: step numbering does not pair up')
    }
  }

  const canonical = new Set([...(en?.commands ?? []), ...(cn?.commands ?? [])])
  if (canonical.size === 0) fail('truth sources publish no deploy command')

  // The landing overview is pinned to the truth source's step count.
  const commands = {
    deploy: canonicalCommand('npx github:gitalk/deploy -c .env -t cloudflare')
  }
  if (canonical.size && !canonical.has(commands.deploy)) {
    fail(`truth sources do not publish the canonical deploy command \`${commands.deploy}\``)
  }

  for (const file of COMMAND_DOCS) {
    const text = read(file)
    for (const raw of text.matchAll(/npx github:gitalk\/deploy[^\n`]*/g)) {
      const command = canonicalCommand(raw[0])
      if (!canonical.has(command)) {
        fail(`${file}: command drifted from the truth source: \`${command}\``)
      }
    }
    if (/gitalk-deploy\s+-c\s/.test(text)) {
      fail(`${file}: uses the bare \`gitalk-deploy\` form; use the published \`npx github:gitalk/deploy\` command`)
    }
  }
  ok(`commands: ${canonical.size} canonical form(s), checked in ${COMMAND_DOCS.length} documents`)

  for (const doc of LINKING_DOCS) {
    const text = read(doc.file)
    const dir = dirname(join(ROOT, doc.file))
    const targets = new Set(
      [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
        .map((m) => m[1].split('#')[0])
        .filter((target) => !/^[a-z]+:/i.test(target) && target)
        .map((target) => resolve(dir, target))
    )
    for (const target of doc.links) {
      if (!targets.has(resolve(ROOT, target))) {
        fail(`${doc.file}: does not link to the truth source \`${target}\``)
      }
    }
  }
  ok(`links: ${LINKING_DOCS.length} documents point at the truth source`)

  for (const file of [...TRUTH_FILES, 'readme.md', 'readme-cn.md', 'docs/guide.md', 'docs/handsoff.md']) {
    checkMarkdownLinks(file)
  }
  ok('links: every relative markdown link resolves')

  const truthSteps = en?.steps ?? null
  if (truthSteps && cn && cn.steps.length !== truthSteps.length) {
    fail('cannot compare the landing page with the truth source: step counts disagree')
  }

  await checkLanding(truthSteps, commands)

  if (errors.length) {
    console.error('\n✗ docs are out of sync:\n')
    for (const error of errors) console.error(`  • ${error}`)
    console.error(`\n  ${errors.length} problem(s). The truth source is ${TRUTH_EN} / ${TRUTH_CN}.\n`)
    process.exit(1)
  }

  console.log('✓ docs are in sync\n')
  for (const message of passes) console.log(`  ✓ ${message}`)
  console.log('')
}

main().catch((error) => {
  console.error(`\n✗ check-docs failed: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
