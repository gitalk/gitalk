import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { de } from './locales/de'
import { esES } from './locales/es-ES'
import { fa } from './locales/fa'
import { fr } from './locales/fr'
import { ja } from './locales/ja'
import { ko } from './locales/ko'
import { pl } from './locales/pl'
import { ru } from './locales/ru'
import { zhTW } from './locales/zh-TW'
import { CDN_SCRIPT } from './snippets'

/**
 * Landing-page copy, in the eleven locales the site ships.
 *
 * Deliberately a plain typed dictionary rather than a runtime i18n library:
 * the page has one screen's worth of text, and `typeof zh` makes every other
 * dictionary fail to compile if it ever drifts out of sync — missing keys,
 * extra keys and misplaced values are all type errors.
 *
 * `zh` below is the source dictionary. `en` lives here too, next to it; the
 * other nine locales are in ./locales so this file stays readable.
 *
 * English wording follows readme.md (the counterpart of readme-cn.md) and the
 * terminology in docs/tech.md. Brand and product names (Gitalk, GitHub
 * Discussions, Cloudflare, CloudBase, React, Vue, …) stay untranslated.
 */
export type Lang =
  | 'zh'
  | 'en'
  | 'zh-TW'
  | 'ja'
  | 'ko'
  | 'es-ES'
  | 'fr'
  | 'ru'
  | 'de'
  | 'pl'
  | 'fa'

/**
 * In display order; each language names itself, so this never changes.
 * The ids match the widget's own locale keys, so the demo can pass them
 * straight through (only `zh` is remapped, to `zh-CN`).
 */
export const LANGS: ReadonlyArray<{ id: Lang; label: string }> = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'English' },
  { id: 'zh-TW', label: '繁體中文' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'es-ES', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'ru', label: 'Русский' },
  { id: 'de', label: 'Deutsch' },
  { id: 'pl', label: 'Polski' },
  { id: 'fa', label: 'فارسی' }
]

const STORAGE_KEY = 'gitalk-landing-lang'

const zh = {
  meta: {
    title: 'Gitalk 2.0 — 基于 GitHub Discussions 的评论组件',
    description:
      'Gitalk 2.0：基于 GitHub Discussions 的评论组件，提供无框架、React 与 Vue 三种构建。'
  },
  nav: {
    features: '特性',
    usage: '用法',
    demo: '演示',
    faq: 'FAQ',
    v1Title: 'Gitalk 1.x 的旧版落地页',
    theme: '切换主题',
    language: '切换语言',
    github: 'GitHub 仓库'
  },
  ambient: {
    aria: '环境音：{season} · {state}',
    stateOn: '已开启',
    stateOff: '已关闭',
    defaultTag: '（默认）',
    hint: '点击开关 · 右键或 ← → 切换季节 · ↑ ↓ 调音量（{volume}%）',
    seasons: {
      spring: '春雨',
      summer: '夏虫',
      autumn: '秋火',
      winter: '冬雪'
    }
  },
  hero: {
    eyebrow: '// GITHUB DISCUSSIONS POWERED COMMENTS',
    titleLine1: '评论区，',
    titleLine2: '轻得像',
    titleEm: '一行代码',
    lede: '把 GitHub Discussions 或 Issues 变成你的评论区。一条命令部署轻量代理，无需数据库，评论实时同步。',
    statsTitle: '关键指标',
    stats: {
      lines: { value: '5', label: '步快速接入', note: '创建 App、部署、准备仓库、安装、引入组件。' },
      comments: { value: '∞', label: '评论容量', note: '由 GitHub Discussions 承载。' },
      size: { label: '不是最小但最强', note: 'gzip 压缩后的实际传输体积。' },
      deps: { value: '0', label: '运行时依赖', note: '渲染层已打包进产物。' },
      stars: { label: 'Stars', note: 'GitHub 上的社区关注度。' }
    },
    modeLabel: '布局模式', endpointLabel: '接口端点', modeDefault: '默认', modeInline: '内嵌'
  },
  getStarted: {
    eyebrow: '接入',
    title: '五步接上评论',
    lede: '顺序按实际依赖排：先建 App（账号级对象，不需要先有仓库），再部署最重的服务；仓库要先存在，才能把 App 装上去。',
    steps: [
      {
        title: '创建 GitHub App',
        body: '在账号或组织设置里创建 —— 不在仓库的 Settings 里。权限只要 Discussions: Read and write 和 Metadata: Read-only。',
        code: ''
      },
      {
        title: '部署 proxy，再补 callback URL',
        body: '一条命令部署；等它打印出地址，再回 App 把 Callback URL 填成 <地址>/oauth/callback。',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: '准备仓库',
        body: '仓库必须是 public，并在 Settings → General → Features → Discussions 打开 Discussions，再建一个分类。',
        code: ''
      },
      {
        title: '把 App 安装到仓库',
        body: '创建完还不够：打开 App 的安装页（github.com/apps/my-niubi-gitalk/installations/new），只勾存放评论的仓库，比如 demo-repo。不装的话拿不到 installation token，匿名读退回 60 次/小时。',
        code: ''
      },
      {
        title: '引入组件',
        body: '把 clientID、owner、repo、admin、number 和部署得到的 proxy 填进去（示例：owner octocat、repo demo-repo）。',
        code: ''
      }
    ],
    more: '完整步骤见 deploy CLI 的 README —— 凭据、.env、CloudBase、全部变量',
    domainTitle: '自定义域名',
    domainBody: '域名在 Cloudflare 时可以直接绑；在别处需要在域名商加一条 CNAME。CloudBase 的自定义域名还需要 ICP 备案 —— 这两件得人工做。GitHub App 的 callback URL 也只能在网页改（org 所有的 App 不能用 API 改）。'
  },
  features: {
    eyebrow: "// WHAT'S NEW",
    // The English title is intentional in both locales; the user asked for it.
    title: "What's New",
    lede: '2.0 把内核重写了一遍：默认落在 Discussions，登录走 OAuth，浏览器里不再有密钥。',
    items: [
      {
        title: 'Discussions 默认承载',
        body: '评论落在 Discussions 里，不污染 issue 列表，也没有 v1 那个「label 超过 50 字符就报错」的坑。'
      },
      {
        title: 'Issues 可选兼容',
        body: '老站点设 backend: "issues" 即可沿用原来的数据，迁移可以一页一页慢慢来。'
      },
      {
        title: '无框架 / React / Vue',
        body: '同一个内核，三种用法。包装层各自不到 1 kB，且不会和你项目里的框架版本打架。'
      },
      {
        title: '不再泄露 secret',
        body: 'v1 把 clientSecret 写进前端、再发给陌生代理。2.0 改为你自部署的 edge function，浏览器里没有密钥。'
      },
      {
        title: '零运行时依赖',
        body: '渲染层只有 Preact。日期用原生 Intl.RelativeTimeFormat，Markdown 用 GitHub 渲染好的 HTML。'
      },
      {
        title: '现代工具链',
        body: 'Vite 8 · TypeScript 7 · Vitest 5 · pnpm monorepo · release-please 自动发版。'
      }
    ]
  },
  flow: {
    eyebrow: '// DATA FLOW',
    title: '数据是怎么流动的',
    lede: '匿名可读、登录才写。这不是限制，是 GitHub 的接口形态逼出来的唯一解。',
    anonTitle: '匿名访客',
    anonBadge: '无需登录',
    anonPoints: [
      '经 REST API 读取评论（60 次/小时/IP）',
      '直接拿到 GitHub 渲染好的 HTML',
      '带 ETag 的重复请求不计入限额'
    ],
    authTitle: '登录用户',
    authBadge: 'OAuth',
    authPoints: [
      '经 GraphQL 评论、回复、点赞',
      '5000 点/小时，成本每条查询 1 点',
      'token 存 localStorage，可随时注销'
    ],
    note: '写操作必须走 GraphQL，因为 GitHub 没有 Discussions 的 REST 写接口（实测连 `POST` 路由都不存在）。而 GraphQL 的匿名额度是 `0`，所以「匿名读 + 登录写」是这套架构的必然形态，不是偷懒。'
  },
  tabs: {
    eyebrow: '// GET STARTED',
    title: '三种用法',
    lede: '同一个内核，挑一个和你项目最合得来的入口。',
    items: {
      vanilla: {
        label: '无框架',
        hint: '一个 script 标签 + 一行初始化',
        code: `<!-- 1. 引入产物 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<!-- 2. 容器 -->
<div id="gitalk-container"></div>

<!-- 3. 初始化 -->
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    id: location.pathname,   // 页面唯一标识
    number: 42,              // 已创建的 discussion 编号（推荐显式指定）
    backend: 'discussions',  // 默认；老站点可写 'issues'
    perPage: 10
  })

  gitalk.render('gitalk-container')
</script>`
      },
      react: {
        label: 'React',
        hint: 'peerDependency: react >= 18',
        code: `import { Gitalk } from '@aifire/gitalk-react'
import '@aifire/gitalk/style.css'

export function Comments() {
  return (
    <Gitalk
      options={{
        clientID: 'Iv1.xxxxxxxx',
        owner: 'you',
        repo: 'comments',
        admin: ['you'],
        number: 42,
        backend: 'discussions',
        perPage: 10
      }}
    />
  )
}`
      },
      vue: {
        label: 'Vue',
        hint: 'peerDependency: vue >= 3.4',
        code: `<script setup lang="ts">
import { Gitalk } from '@aifire/gitalk-vue'
import '@aifire/gitalk/style.css'

const options = {
  clientID: 'Iv1.xxxxxxxx',
  owner: 'you',
  repo: 'comments',
  admin: ['you'],
  number: 42,
  backend: 'discussions',
  perPage: 10
}
</script>

<template>
  <Gitalk :options="options" />
</template>`
      }
    },
    note: '登录必须经过 proxy：`github.com/login/oauth/access_token` 不返回 CORS 头，浏览器无法自行完成 token 交换。部署方式见上面的五步，CloudBase 与自托管见仓库 README。'
  },
  faq: {
    eyebrow: '// FAQ',
    title: '常见问题',
    items: [
      {
        q: '能直接用 CDN 引入吗？',
        a: '组件本身可以。但登录和发评论不能共用官方 proxy —— 它只放行 Gitalk 项目自己的站点，而且跑在项目自己的 App 上。自己的站点要部署一份自己的（一条命令，约五分钟）。',
        code: CDN_SCRIPT
      },
      {
        q: '必须部署 proxy 吗？',
        a: '只读评论不需要 —— 浏览器直连 GitHub REST，匿名额度 60 次/小时。登录、发评论、reaction 才需要，因为 GitHub 的 token 端点不返回 CORS 头。',
        code: ''
      },
      {
        q: '数据存在哪？',
        a: '在你自己的仓库里 —— Discussions 或 Issues。没有中间服务器，随时可以在 GitHub 上导出或迁移。',
        code: ''
      },
      {
        q: '怎么从 v1 迁过来？',
        a: "换掉 `clientID`、加上 `proxy` 就够。老站点设 `backend: 'issues'` 可沿用原来的 Issue，不用迁移数据。",
        code: ''
      },
      {
        q: '为什么评论显示的是用户名而不是昵称？',
        a: '默认显示昵称（GitHub display name），没设昵称的人显示用户名。`@` 提及始终用用户名 —— 昵称在 GitHub 上无法被解析。',
        code: ''
      },
      {
        q: '支持哪些框架？',
        a: '无框架（一个 `<div>` + 一个构造函数）、React、Vue。样式、暗色模式、11 种语言（含波斯语 RTL）都由组件自带。',
        code: ''
      },
      {
        q: '免费吗？',
        a: '组件是 MIT。proxy 用各平台免费额度就够绝大多数站点；没有服务器成本，也没有收费计划。',
        code: ''
      }
    ]
  },
  footer: {
    note: 'MIT · 基于 GitHub Discussions',
    repo: '查看仓库'
  }
}

/** The Chinese dictionary is the shape every locale must match. */
export type Messages = typeof zh

const en: Messages = {
  getStarted: {
    eyebrow: 'Setup',
    title: 'Five steps to comments',
    lede: 'The order follows the dependencies: the App is an account-level object, so it comes first and needs no repository; deployment is the heaviest job; and the repository must exist before the App can be installed on it.',
    steps: [
      {
        title: 'Create the GitHub App',
        body: 'Create it in your account or organisation settings — not in the repository Settings. Only Discussions: Read and write and Metadata: Read-only are needed.',
        code: ''
      },
      {
        title: 'Deploy the proxy, then set the callback URL',
        body: 'One command deploys it. Wait for the address it prints, then set the App Callback URL to <address>/oauth/callback.',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: 'Prepare the repository',
        body: 'It must be public, with Discussions enabled under Settings → General → Features → Discussions, and at least one category.',
        code: ''
      },
      {
        title: 'Install the App on the repository',
        body: 'Creating it is not enough: open github.com/apps/my-niubi-gitalk/installations/new and tick the repository that stores comments, demo-repo. Without the install the proxy gets no installation token and anonymous reads drop to 60/hour.',
        code: ''
      },
      {
        title: 'Embed the component',
        body: 'Pass clientID, owner, repo, admin, number and the proxy the deploy printed (example: owner octocat, repo demo-repo).',
        code: ''
      }
    ],
    more: 'Complete steps: the deploy CLI README — credentials, .env, CloudBase, every variable',
    domainTitle: 'Custom domains',
    domainBody: 'A domain on Cloudflare can be bound directly; anywhere else needs a CNAME record added by hand. CloudBase additionally requires an ICP filing. The App callback URL always has to be edited in the web UI — organisation-owned Apps cannot be changed through the API.'
  },
  meta: {
    title: 'Gitalk 2.0 — A comment component backed by GitHub Discussions',
    description:
      'Gitalk 2.0: a serverless comment component backed by GitHub Discussions. Framework-free, React, and Vue builds.'
  },
  nav: {
    features: 'Features',
    usage: 'Usage',
    demo: 'Demo',
    faq: 'FAQ',
    v1Title: 'The Gitalk 1.x site',
    theme: 'Toggle theme',
    language: 'Switch language',
    github: 'GitHub repository'
  },
  ambient: {
    aria: 'Ambient: {season} · {state}',
    stateOn: 'on',
    stateOff: 'off',
    defaultTag: ' (default)',
    hint: 'Click to toggle · right-click or ← → for the season · ↑ ↓ for volume ({volume}%)',
    seasons: {
      spring: 'Spring rain',
      summer: 'Summer insects',
      autumn: 'Autumn fire',
      winter: 'Winter snow'
    }
  },
  hero: {
    eyebrow: '// GITHUB DISCUSSIONS POWERED COMMENTS',
    titleLine1: 'Comments,',
    titleLine2: 'light as ',
    titleEm: 'one line',
    lede: 'Turn GitHub Discussions or Issues into your comment section. Deploy a lightweight proxy with one command. No database, and comments sync in real time.',
    statsTitle: 'Key numbers',
    stats: {
      lines: { value: '5', label: 'steps', note: 'Create the App, deploy, prepare the repo, install, embed.' },
      comments: {
        value: '∞',
        label: 'Comments',
        note: 'Carried by GitHub Discussions.'
      },
      size: { label: 'not the smallest', note: 'Actual transfer size after gzip.' },
      deps: {
        value: '0',
        label: 'Runtime deps',
        note: 'The render layer ships in the bundle.'
      },
      stars: { label: 'Stars', note: 'Community interest on GitHub.' }
    },
    modeLabel: 'Layout mode', endpointLabel: 'Endpoint', modeDefault: 'Default', modeInline: 'Inline'
  },
  features: {
    eyebrow: "// WHAT'S NEW",
    title: "What's New",
    lede: '2.0 is a rewrite of the core: Discussions by default, OAuth for writes, and no secret anywhere in the browser.',
    items: [
      {
        title: 'Discussions by default',
        body: 'Comments live in Discussions, so they never clutter the issue list — and the 1.x bug where a label over 50 characters fails is gone.'
      },
      {
        title: 'Issues as an option',
        body: 'Existing sites can set backend: "issues" and keep their data, so migration can happen one page at a time.'
      },
      {
        title: 'Framework-free / React / Vue',
        body: 'One core, three ways to use it. Each wrapper is under 1 kB and will not fight the framework version in your project.'
      },
      {
        title: 'No more leaked secrets',
        body: '1.x put clientSecret in the page and sent it to a third-party proxy. 2.0 uses an edge function you deploy yourself — no secret in the browser.'
      },
      {
        title: 'Zero runtime dependencies',
        body: 'The render layer is Preact only. Dates use the native Intl.RelativeTimeFormat, and Markdown arrives as HTML rendered by GitHub.'
      },
      {
        title: 'Modern toolchain',
        body: 'Vite 8 · TypeScript 7 · Vitest 5 · pnpm monorepo · releases automated by release-please.'
      }
    ]
  },
  flow: {
    eyebrow: '// DATA FLOW',
    title: 'How the data flows',
    lede: 'Anonymous reads, signed-in writes. That is not a shortcut; GitHub’s APIs leave no other option.',
    anonTitle: 'Anonymous visitors',
    anonBadge: 'No sign-in',
    anonPoints: [
      'Reads comments over the REST API (60 requests/hour per IP)',
      'Gets HTML rendered by GitHub directly',
      'Repeat requests with an ETag do not count against the limit'
    ],
    authTitle: 'Signed-in users',
    authBadge: 'OAuth',
    authPoints: [
      'Comments, replies and reactions over GraphQL',
      '5,000 points/hour; one point per query',
      'The token lives in localStorage and can be revoked at any time'
    ],
    note: 'Writes must go through GraphQL, because GitHub exposes no REST write API for Discussions (the `POST` routes do not exist). Anonymous GraphQL gets a quota of literally `0`, so “anonymous reads + signed-in writes” is what the architecture forces, not a shortcut.'
  },
  tabs: {
    eyebrow: '// GET STARTED',
    title: 'Three ways to use it',
    lede: 'One core, three entry points. Pick whichever fits the project in front of you.',
    items: {
      vanilla: {
        label: 'Framework-free',
        hint: 'One script tag and one line to initialise',
        code: `<!-- 1. Load the build -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<!-- 2. Container -->
<div id="gitalk-container"></div>

<!-- 3. Initialise -->
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    id: location.pathname,   // unique page identifier
    number: 42,              // existing discussion number (recommended)
    backend: 'discussions',  // default; 1.x sites can pass 'issues'
    perPage: 10
  })

  gitalk.render('gitalk-container')
</script>`
      },
      react: {
        label: 'React',
        hint: 'peerDependency: react >= 18',
        code: `import { Gitalk } from '@aifire/gitalk-react'
import '@aifire/gitalk/style.css'

export function Comments() {
  return (
    <Gitalk
      options={{
        clientID: 'Iv1.xxxxxxxx',
        owner: 'you',
        repo: 'comments',
        admin: ['you'],
        number: 42,
        backend: 'discussions',
        perPage: 10
      }}
    />
  )
}`
      },
      vue: {
        label: 'Vue',
        hint: 'peerDependency: vue >= 3.4',
        code: `<script setup lang="ts">
import { Gitalk } from '@aifire/gitalk-vue'
import '@aifire/gitalk/style.css'

const options = {
  clientID: 'Iv1.xxxxxxxx',
  owner: 'you',
  repo: 'comments',
  admin: ['you'],
  number: 42,
  backend: 'discussions',
  perPage: 10
}
</script>

<template>
  <Gitalk :options="options" />
</template>`
      }
    },
    note: 'Signing in must go through a proxy: `github.com/login/oauth/access_token` sends no CORS headers, so the browser cannot complete the token exchange alone. Deployment is the five steps above; CloudBase and self-hosting are covered in the repository README.'
  },
  faq: {
    eyebrow: '// FAQ',
    title: 'Frequently asked questions',
    items: [
      {
        q: 'Can I load it straight from a CDN?',
        a: "The component itself, yes. But sign-in and posting comments cannot share the official proxy — it only allows this project's own sites and runs on the project's own App. Your site needs its own deployment (one command, about five minutes).",
        code: CDN_SCRIPT
      },
      {
        q: 'Do I have to deploy a proxy?',
        a: 'Only reading comments does not need one — the browser talks to GitHub REST directly, with an anonymous quota of 60 requests per hour. Signing in, posting comments and reactions do, because GitHub’s token endpoint sends no CORS headers.',
        code: ''
      },
      {
        q: 'Where does the data live?',
        a: 'In your own repository — Discussions or Issues. There is no server in between, and you can export or migrate on GitHub at any time.',
        code: ''
      },
      {
        q: 'How do I migrate from v1?',
        a: "Replace `clientID` and add `proxy`, and that is enough. Existing sites can set `backend: 'issues'` to keep using their current Issue, with no data migration.",
        code: ''
      },
      {
        q: 'Why do comments show the username instead of the display name?',
        a: 'The default is the GitHub display name, falling back to the username for anyone who has not set one. `@` mentions always use the username — GitHub cannot resolve a display name.',
        code: ''
      },
      {
        q: 'Which frameworks are supported?',
        a: 'Framework-free (one `<div>` and one constructor), React and Vue. Styles, dark mode and all eleven languages (Persian RTL included) ship with the component.',
        code: ''
      },
      {
        q: 'Is it free?',
        a: 'The component is MIT. For most sites the proxy fits inside each platform’s free tier: no server cost and no paid plan.',
        code: ''
      }
    ]
  },
  footer: {
    note: 'MIT · powered by GitHub Discussions',
    repo: 'View repository'
  }
}

const MESSAGES: Record<Lang, Messages> = {
  zh,
  en,
  'zh-TW': zhTW,
  ja,
  ko,
  'es-ES': esES,
  fr,
  ru,
  de,
  pl,
  fa
}

/**
 * Every dictionary, keyed by locale id.
 *
 * Exported so `scripts/check-docs.mjs` can assert that all eleven stay in step
 * with the deploy README (step count, banned claims, lengths) by importing the
 * dictionaries instead of parsing TSX.
 */
export const DICTS: Readonly<Record<Lang, Messages>> = MESSAGES

export interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Messages
}

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  // Keeps <html lang>, dir, <title> and the meta description in step with the
  // UI. A layout effect rather than an effect: with a stored RTL locale the
  // first paint must already be mirrored, not flash LTR for a frame.
  useLayoutEffect(() => {
    applyDocumentLanguage(lang)
  }, [lang])

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage disabled (private mode): the choice simply will not persist.
    }
  }, [])

  const value = useMemo<I18n>(() => ({ lang, setLang, t: MESSAGES[lang] }), [lang, setLang])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>')
  return context
}

/**
 * BCP 47 tag for a locale id. Only `zh` needs translating: it is the
 * Simplified dictionary, which the widget and BCP 47 both call zh-CN.
 */
export function htmlLang(lang: Lang): string {
  return lang === 'zh' ? 'zh-CN' : lang
}

/**
 * Persian is the only right-to-left locale the page ships. The layout mirrors
 * from logical CSS properties, so this only has to drive the document
 * direction; no component needs a per-language flag.
 */
export function isRtlLang(lang: Lang): boolean {
  return lang === 'fa'
}

/**
 * Renders a dictionary string, turning each `backticked` run into <code>.
 * Keeps the dictionaries plain strings instead of JSX, and the inline-code
 * styling of the original markup intact.
 */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('`').map((part, index) =>
        index % 2 === 1 ? <code key={index}>{part}</code> : part
      )}
    </>
  )
}

/**
 * Detection order: the choice remembered in localStorage, then the browser
 * language — matched against all eleven locales by primary subtag — then
 * Chinese. `zh-TW`, `zh-HK`, `zh-MO` and any `*-Hant*` tag resolve to
 * Traditional; every other `zh-*` tag resolves to Simplified.
 */
export function detectLang(): Lang {
  const stored = readStoredLang()
  if (stored) return stored

  const preferred = typeof navigator === 'undefined' ? '' : navigator.language
  if (!preferred) return 'zh'
  return matchBrowserLang(preferred) ?? 'zh'
}

const BROWSER_BASE: Record<string, Lang> = {
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  es: 'es-ES',
  fr: 'fr',
  ru: 'ru',
  de: 'de',
  pl: 'pl',
  fa: 'fa'
}

function matchBrowserLang(preferred: string): Lang | null {
  const lower = preferred.toLowerCase()
  if (lower.startsWith('zh')) {
    return /^zh-(tw|hk|mo)\b/.test(lower) || /-hant\b/.test(lower) ? 'zh-TW' : 'zh'
  }
  return BROWSER_BASE[lower.split('-')[0] ?? ''] ?? null
}

function readStoredLang(): Lang | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return LANGS.find((option) => option.id === raw)?.id ?? null
  } catch {
    return null
  }
}

function applyDocumentLanguage(lang: Lang): void {
  if (typeof document === 'undefined') return
  const { title, description } = MESSAGES[lang].meta
  const root = document.documentElement
  root.lang = htmlLang(lang)
  // `dir` is set only for RTL: the ten LTR locales keep exactly the document
  // they had before, with no attribute to inherit from.
  if (isRtlLang(lang)) root.setAttribute('dir', 'rtl')
  else root.removeAttribute('dir')
  document.title = title
  document.querySelector('meta[name="description"]')?.setAttribute('content', description)
}
