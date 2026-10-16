# Gitalk 2.0 中文文档

基于 **GitHub Discussions**（默认）或 GitHub Issues 的评论组件。
无后端、无数据库、不经过任何第三方代理。

[English](readme.md) · [在线 Demo](https://gitalk.github.io) · [讨论区](https://github.com/gitalk/gitalk/discussions)

## 相比 1.x 的变化

| | 1.x | 2.0 |
|---|---|---|
| 存储 | GitHub Issues | **GitHub Discussions**（Issues 可选） |
| 工具链 | webpack 3 · Babel 6 · Preact 8 | Vite 8 · TypeScript 7 · Preact 11 |
| 鉴权 | `clientSecret` 写进页面 + 第三方 CORS 代理 | 自部署 edge function，**浏览器不含密钥** |
| 发版 | standard-version | release-please |
| 产物 | 仅 UMD | ESM + IIFE + React + Vue |

所有 API 行为结论均有实测记录，详见 [docs/tech.md](docs/tech.md)。

## 安装

```sh
pnpm add @gitalk/core       # 无框架
pnpm add @gitalk/react      # React
pnpm add @gitalk/vue        # Vue
```

## 用法

### 无框架

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/gitalk@2/dist/gitalk.js"></script>

<div id="gitalk-container"></div>
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxx',
    owner: 'you',
    repo: 'comments',
    admin: ['you'],
    number: 42,              // discussion 编号，推荐显式指定
    backend: 'discussions'
  })
  gitalk.render('gitalk-container')
</script>
```

### React

```tsx
import { Gitalk } from '@gitalk/react'
import '@gitalk/core/style.css'

<Gitalk options={{ clientID: 'Iv1.xxxxxxxx', owner: 'you', repo: 'comments', admin: ['you'], number: 42 }} />
```

### Vue

```vue
<script setup lang="ts">
import { Gitalk } from '@gitalk/vue'
import '@gitalk/core/style.css'

const options = { clientID: 'Iv1.xxxxxxxx', owner: 'you', repo: 'comments', admin: ['you'], number: 42 }
</script>

<template>
  <Gitalk :options="options" />
</template>
```

## 配置项

| 选项 | 默认值 | 说明 |
|---|---|---|
| `clientID` | — | OAuth Application 的 client id |
| `owner`、`repo` | — | 承载评论的仓库 |
| `admin` | `[]` | 允许初始化评论的用户 |
| `backend` | `'discussions'` | 老站点可填 `'issues'` |
| `number` | — | Discussion 编号，**推荐**，可省去标题扫描 |
| `id` | `location.pathname` | 未指定 `number` 时使用的页面标识 |
| `category` | — | 创建 discussion 时使用的分类 |
| `perPage` | `10` | 每页条数 |
| `proxy` | — | 你自己部署的 token 交换端点 |
| `language` | `navigator.language` | 沿用 1.x 的 11 种语言 |

## 部署准备

1. 在仓库开启 **Discussions**，并建一个分类（默认 `General`）。
2. 注册 **OAuth Application**，记下 client id。**不要把 client secret 写进页面。**
3. 部署 [`packages/proxy-worker`](packages/proxy-worker) 到
   Cloudflare Workers / Vercel / Netlify，配置
   `GITALK_CLIENT_ID`、`GITALK_CLIENT_SECRET`、`GITALK_ALLOWED_ORIGINS`。
4. 把部署后的地址填到 `proxy`。

### 为什么需要代理？

`github.com/login/oauth/access_token` 不返回 `Access-Control-Allow-Origin`，
浏览器无法自行完成 token 交换。Device Flow 我们同样实测过：它不需要
`client_secret`，但也被同样的 CORS 限制挡住。因此纯静态页面没有任何办法
自行获取 token，详见 [docs/tech.md §3.2](docs/tech.md)。

代理让密钥只存在于你自己的部署环境里。

## 匿名阅读

未登录访客通过 REST API 读取评论（60 次/小时/IP）。配合
`ETag` / `If-None-Match`，未变更的响应不计入限额。已登录用户走
GraphQL（5000 点/小时）——写操作必须走 GraphQL，因为 GitHub 没有
Discussions 的 REST 写接口。

## 本地开发

```sh
pnpm install
pnpm dev            # 落地页 + 实时评论组件
pnpm test           # 28 项测试
pnpm build          # 构建所有包
pnpm typecheck
```

## 许可

MIT
