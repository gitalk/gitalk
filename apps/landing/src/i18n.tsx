import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

/**
 * Landing-page copy, in the two locales the site ships.
 *
 * Deliberately a plain typed dictionary rather than a runtime i18n library:
 * the page has one screen's worth of text, and `typeof zh` makes the English
 * dictionary fail to compile if it ever drifts out of sync.
 *
 * English wording follows readme.md (the counterpart of readme-cn.md) and the
 * terminology in docs/tech.md. Brand and product names (Gitalk, GitHub
 * Discussions, Cloudflare, CloudBase, React, Vue, …) stay untranslated.
 */
export type Lang = 'zh' | 'en'

/** In display order; each language names itself, so this never changes. */
export const LANGS: ReadonlyArray<{ id: Lang; label: string }> = [
  { id: 'zh', label: '中' },
  { id: 'en', label: 'EN' }
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
    demo: 'Demo',
    theme: '切换主题',
    language: '切换语言'
  },
  hero: {
    eyebrow: 'Serverless comments · GitHub Discussions',
    titleLine1: '把评论区',
    titleLine2: '搬回你的仓库',
    lede: 'Gitalk 2.0 用 GitHub Discussions 承载评论。无后端、无数据库、无第三方代理——匿名访客可直接阅读，登录后即可评论与点赞。',
    getStarted: '开始使用',
    viewSource: '查看源码',
    size: '体积',
    runtimeDeps: '运行时依赖',
    stars: 'Star'
  },
  features: {
    // The English title is intentional in both locales; the user asked for it.
    title: "What's New",
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
    title: '数据是怎么流动的',
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
    title: '三种用法',
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
    note: '登录需要在 `proxy` 里指向你自己部署的 edge function——因为 `github.com/login/oauth/access_token` 不返回 CORS 头，浏览器无法自行完成 token 交换。源码在 `packages/proxy-worker`，支持 Cloudflare Workers / Vercel / Netlify 一键部署。'
  },
  demo: {
    title: '实时 Demo',
    lede: '下面的评论框就是 `@aifire/gitalk` 本身。它直接读取 `gitalk/gitalk` 的 Discussions，匿名即可查看，登录后可评论。',
    endpointsLabel: '令牌端点',
    endpoints: {
      cloudflare: 'Cloudflare',
      cloudbase: '腾讯云 CloudBase'
    }
  }
}

/** The Chinese dictionary is the shape every locale must match. */
type Messages = typeof zh

const en: Messages = {
  meta: {
    title: 'Gitalk 2.0 — A comment component backed by GitHub Discussions',
    description:
      'Gitalk 2.0: a serverless comment component backed by GitHub Discussions. Framework-free, React, and Vue builds.'
  },
  nav: {
    features: 'Features',
    usage: 'Usage',
    demo: 'Demo',
    theme: 'Toggle theme',
    language: 'Switch language'
  },
  hero: {
    eyebrow: 'Serverless comments · GitHub Discussions',
    titleLine1: 'Bring comments',
    titleLine2: 'back to your repo',
    lede: 'Gitalk 2.0 keeps comments in GitHub Discussions. No backend, no database, no third-party proxy — anonymous visitors can read, and signing in lets them comment and react.',
    getStarted: 'Get started',
    viewSource: 'View source',
    size: 'Size',
    runtimeDeps: 'Runtime deps',
    stars: 'Stars'
  },
  features: {
    title: "What's New",
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
    title: 'How the data flows',
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
    title: 'Three ways to use it',
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
    note: 'Signing in needs `proxy` pointed at an edge function you deploy yourself — `github.com/login/oauth/access_token` sends no CORS headers, so the browser cannot complete the token exchange on its own. The source is in `packages/proxy-worker`, with one-command deploys for Cloudflare Workers / Vercel / Netlify.'
  },
  demo: {
    title: 'Live demo',
    lede: 'The comment box below is `@aifire/gitalk` itself. It reads the Discussions of `gitalk/gitalk` directly: anyone can browse anonymously and sign in to comment.',
    endpointsLabel: 'Token endpoint',
    endpoints: {
      cloudflare: 'Cloudflare',
      cloudbase: 'Tencent CloudBase'
    }
  }
}

const MESSAGES: Record<Lang, Messages> = { zh, en }

export interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: Messages
}

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectLang)

  // Keeps <html lang>, <title> and the meta description in step with the UI.
  useEffect(() => {
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
 * language (`zh*` → Chinese, anything else → English), then Chinese.
 */
export function detectLang(): Lang {
  const stored = readStoredLang()
  if (stored) return stored

  const preferred = typeof navigator === 'undefined' ? '' : navigator.language
  if (!preferred) return 'zh'
  return preferred.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

function readStoredLang(): Lang | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw === 'zh' || raw === 'en' ? raw : null
  } catch {
    return null
  }
}

function applyDocumentLanguage(lang: Lang): void {
  if (typeof document === 'undefined') return
  const { title, description } = MESSAGES[lang].meta
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  document.title = title
  document.querySelector('meta[name="description"]')?.setAttribute('content', description)
}
