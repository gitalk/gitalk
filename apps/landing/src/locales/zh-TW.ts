import type { Messages } from '../i18n'

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
      lines: { value: '4', label: '步快速接入', note: '建立 App、填寫變數、部署、引入，四步完成。' },
      comments: { value: '∞', label: '評論容量', note: '由 GitHub Discussions 承載。' },
      size: { label: '不是最小但最強', note: 'gzip 壓縮後的實際傳輸大小。' },
      deps: { value: '0', label: '執行時依賴', note: '渲染層已打包進產物。' },
      stars: { label: 'Stars', note: 'GitHub 上的社群關注度。' }
    },
    modeLabel: '版面模式', endpointLabel: 'API 端點', modeDefault: '預設', modeInline: '內嵌'
  },
  getStarted: {
    eyebrow: '接入',
    title: '四步接上評論',
    lede: '三步是你親自做的（建立 App、填寫變數、引入元件），一步是一條指令。順序不能換 —— 第 3 步要等第 2 步的變數齊了才能跑。',
    steps: [
      {
        title: '建立 GitHub App',
        body: '在 Settings → Developer settings → GitHub Apps 新建。權限勾選 Discussions: Read and write 與 Metadata: Read-only；Callback URL 填 <你的代理位址>/oauth/callback；Webhook 關掉（用不到）。',
        code: ''
      },
      {
        title: '準備環境變數',
        body: '把 App ID、Client ID、Client Secret 和私鑰（.pem 的全文，不是 SHA256 指紋）寫進一個 .env；工作階段金鑰用 openssl rand -hex 32 產生。',
        code: 'GITHUB_APP_ID=…\nGITHUB_APP_PRIVATE_KEY="-----BEGIN…"\nSESSION_ENCRYPTION_KEY=$(openssl rand -hex 32)'
      },
      {
        title: '一條指令部署',
        body: 'CLI 會先驗證所有變數（缺哪個會明確告訴你），再把憑證作為 secret 上傳，然後部署並自檢 /health，最後印出該填進 proxy 的位址。',
        code: 'npx github:gitalk/deploy -c .env -t cloudflare'
      },
      {
        title: '引入元件',
        body: '把上一步印出的位址填進 proxy，評論就能用了。樣式、暗色、多語言都由元件自己帶。',
        code: "new Gitalk({\n  clientID: 'Iv23li…',\n  proxy: 'https://gitalk-proxy.<account>.workers.dev'\n})"
      }
    ],
    more: 'CloudBase、自架與全部變數說明 → 部署 CLI 的 README',
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
    note: '登入必須經過 proxy：`github.com/login/oauth/access_token` 不返回 CORS 標頭，瀏覽器無法自行完成 token 交換。部署方式見上面的四步，CloudBase 與自架見儲存庫 README。'
  },
  footer: {
    note: 'MIT · 以 GitHub Discussions 為基礎',
    repo: '查看儲存庫'
  }
}
