import type { Messages } from '../i18n'
import { CDN_SCRIPT } from '../snippets'

/** Traditional Chinese (Taiwan). Typed against `zh`, the source locale. */
export const zhTW: Messages = {
  meta: {
    title: 'Gitalk 2.0 — 以 GitHub Discussions 為基礎的評論元件',
    description:
      'Gitalk 2.0：以 GitHub Discussions 為基礎的評論元件，提供無框架、React 與 Vue 三種建置。'
  },
  nav: {
    features: '功能',
    usage: '用法',
    demo: '示範',
    faq: 'FAQ',
    v1Title: 'Gitalk 1.x 的舊版頁面',
    theme: '切換主題',
    language: '切換語言',
    github: 'GitHub 儲存庫'
  },
  ambient: {
    aria: '環境音：{season} · {state}',
    stateOn: '已開啟',
    stateOff: '已關閉',
    defaultTag: '（預設）',
    hint: '點擊開關 · 右鍵或 ← → 切換季節 · ↑ ↓ 調整音量（{volume}%）',
    seasons: {
      spring: '春雨',
      summer: '夏蟲',
      autumn: '秋火',
      winter: '冬雪'
    }
  },
  hero: {
    eyebrow: '// GITHUB DISCUSSIONS POWERED COMMENTS',
    titleLine1: '評論區，',
    titleLine2: '輕得像',
    titleEm: '一行程式碼',
    lede: '把 GitHub Discussions 或 Issues 變成你的評論區。一行指令部署輕量代理，無需資料庫，評論即時同步。',
    statsTitle: '關鍵指標',
    stats: {
      lines: { value: '5', label: '步快速接入', note: '準備儲存庫、建立 App、部署、安裝、引入。' },
      comments: { value: '∞', label: '評論容量', note: '由 GitHub Discussions 承載。' },
      size: { label: '不是最小但最強', note: 'gzip 壓縮後的實際傳輸大小。' },
      deps: { value: '0', label: '執行時依賴', note: '渲染層已打包進產物。' },
      stars: { label: 'Stars', note: 'GitHub 上的社群關注度。' }
    },
    modeLabel: '版面模式', endpointLabel: 'API 端點', modeDefault: '預設', modeInline: '內嵌'
  },
  getStarted: {
    eyebrow: '接入',
    title: '五步接上評論',
    lede: '順序不能換：先準備儲存庫，再建立 App、部署 proxy、把 App 安裝到儲存庫，最後引入元件。每一步只有一份完整說明。',
    steps: [
      {
        title: '準備儲存庫',
        body: '必須是 public，並在 Settings → General → Features → Discussions 開啟 Discussions，再建立一個分類。',
        code: ''
      },
      {
        title: '建立 GitHub App',
        body: '權限只要 Discussions: Read and write 和 Metadata: Read-only。',
        code: ''
      },
      {
        title: '部署 proxy，再補 callback URL',
        body: '一條指令部署；等它印出位址，再回 App 把 Callback URL 填成 <位址>/oauth/callback。',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: '把 App 安裝到儲存庫',
        body: '建立完還不夠：打開 App 的安裝頁（github.com/apps/my-niubi-gitalk/installations/new），只勾存放評論的儲存庫，例如 demo-repo。沒安裝就拿不到 installation token，匿名讀會退回每小時 60 次。',
        code: ''
      },
      {
        title: '引入元件',
        body: '把 clientID、owner、repo、admin、number 和部署得到的 proxy 填進去（範例：owner octocat、repo demo-repo）。',
        code: ''
      }
    ],
    more: '完整步驟見部署 CLI 的 README —— 憑證、.env、CloudBase、全部變數',
    domainTitle: '自訂網域',
    domainBody: '網域在 Cloudflare 時可以直接綁；在別處需要在網域商加一條 CNAME。CloudBase 的自訂網域還需要 ICP 備案 —— 這兩件得人工做。GitHub App 的 callback URL 也只能在網頁改（org 所有的 App 不能用 API 改）。'
  },
  features: {
    eyebrow: "// WHAT'S NEW",
    title: "What's New",
    lede: '2.0 把核心重寫了一遍：預設落在 Discussions，登入走 OAuth，瀏覽器裡不再有金鑰。',
    items: [
      {
        title: 'Discussions 預設承載',
        body: '評論落在 Discussions 裡，不污染 issue 列表，也沒有 v1 那個「label 超過 50 字元就報錯」的坑。'
      },
      {
        title: 'Issues 可選相容',
        body: '舊站台設定 backend: "issues" 即可沿用原來的資料，遷移可以一頁一頁慢慢來。'
      },
      {
        title: '無框架 / React / Vue',
        body: '同一個核心，三種用法。包裝層各自不到 1 kB，且不會和你專案裡的框架版本打架。'
      },
      {
        title: '不再洩露 secret',
        body: 'v1 把 clientSecret 寫進前端、再發給陌生代理。2.0 改為你自部署的 edge function，瀏覽器裡沒有金鑰。'
      },
      {
        title: '零執行時依賴',
        body: '渲染層只有 Preact。日期用原生 Intl.RelativeTimeFormat，Markdown 用 GitHub 渲染好的 HTML。'
      },
      {
        title: '現代工具鏈',
        body: 'Vite 8 · TypeScript 7 · Vitest 5 · pnpm monorepo · release-please 自動發版。'
      }
    ]
  },
  flow: {
    eyebrow: '// DATA FLOW',
    title: '資料是怎麼流動的',
    lede: '匿名可讀、登入才寫。這不是限制，是 GitHub 的介面形態逼出來的唯一解。',
    anonTitle: '匿名訪客',
    anonBadge: '無需登入',
    anonPoints: [
      '經 REST API 讀取評論（60 次/小時/IP）',
      '直接拿到 GitHub 渲染好的 HTML',
      '帶 ETag 的重複請求不計入限額'
    ],
    authTitle: '登入使用者',
    authBadge: 'OAuth',
    authPoints: [
      '經 GraphQL 評論、回覆、按讚',
      '5000 點/小時，成本每條查詢 1 點',
      'token 存 localStorage，可隨時登出'
    ],
    note: '寫入操作必須走 GraphQL，因為 GitHub 沒有 Discussions 的 REST 寫入介面（實測連 `POST` 路由都不存在）。而 GraphQL 的匿名額度是 `0`，所以「匿名讀 + 登入寫」是這套架構的必然形態，不是偷懶。'
  },
  tabs: {
    eyebrow: '// GET STARTED',
    title: '三種用法',
    lede: '同一個核心，挑一個和你專案最合得來的入口。',
    items: {
      vanilla: {
        label: '無框架',
        hint: '一個 script 標籤 + 一行初始化',
        code: `<!-- 1. 引入產物 -->
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
    id: location.pathname,   // 頁面唯一識別
    number: 42,              // 已建立的 discussion 編號（建議明確指定）
    backend: 'discussions',  // 預設；舊站台可寫 'issues'
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
    note: '登入必須經過 proxy：`github.com/login/oauth/access_token` 不返回 CORS 標頭，瀏覽器無法自行完成 token 交換。部署方式見上面的五步，CloudBase 與自架見儲存庫 README。'
  },
  faq: {
    eyebrow: '// FAQ',
    title: '常見問題',
    items: [
      {
        q: '能直接用 CDN 引入嗎？',
        a: '元件本身可以。但登入和發留言不能共用官方 proxy —— 它只放行 Gitalk 專案自己的站點，而且跑在專案自己的 App 上。自己的站點要部署一份自己的（一條指令，約五分鐘）。',
        code: CDN_SCRIPT
      },
      {
        q: '一定要部署 proxy 嗎？',
        a: '只是讀留言的話不需要 —— 瀏覽器直連 GitHub REST，匿名額度 60 次/小時。登入、發留言、reaction 才需要，因為 GitHub 的 token 端點不返回 CORS 標頭。',
        code: ''
      },
      {
        q: '資料存在哪裡？',
        a: '在你自己的儲存庫裡 —— Discussions 或 Issues。沒有中間伺服器，隨時可以在 GitHub 上匯出或遷移。',
        code: ''
      },
      {
        q: '怎麼從 v1 遷過來？',
        a: "換掉 `clientID`、加上 `proxy` 就夠。老站點設 `backend: 'issues'` 可沿用原來的 Issue，不用遷移資料。",
        code: ''
      },
      {
        q: '為什麼留言顯示的是使用者名稱而不是暱稱？',
        a: '預設顯示暱稱（GitHub display name），沒設暱稱的人顯示使用者名稱。`@` 提及始終用使用者名稱 —— 暱稱在 GitHub 上無法被解析。',
        code: ''
      },
      {
        q: '支援哪些框架？',
        a: '無框架（一個 `<div>` + 一個建構函式）、React、Vue。樣式、暗色模式、11 種語言（含波斯語 RTL）都由元件自帶。',
        code: ''
      },
      {
        q: '免費嗎？',
        a: '元件是 MIT。proxy 用各平台免費額度就夠絕大多數站點；沒有伺服器成本，也沒有收費計畫。',
        code: ''
      }
    ]
  },
  footer: {
    note: 'MIT · 以 GitHub Discussions 為基礎',
    repo: '查看儲存庫'
  }
}
