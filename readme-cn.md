# Gitalk 2.0 中文文档

基于 **GitHub Discussions**（默认）或 GitHub Issues 的评论组件。
无后端、无数据库、不经过任何第三方代理。

[English](readme.md) · [在线 Demo](https://gitalk.github.io) · [讨论区](https://github.com/gitalk/gitalk/discussions)

## 快速开始

三步，只有第 1 步需要浏览器和你自己的仓库管理权限。

### 1. 把 App 装到仓库上

Gitalk 2.0 用的是 **GitHub App**，不是 1.x 的 OAuth App：它让令牌端点能在**不把
密钥交给浏览器**的前提下签发 installation token，登录所需的 client secret 也留在服务端。

完整步骤 —— 仓库公开、开启 Discussions、App 权限、**把 App 安装到那个仓库**、凭据与
callback URL —— 只维护在一处：
**[deploy CLI 的 README](packages/gitalk-deploy/README-CN.md)**。只创建 App 是不够的：
没有安装，proxy 就拿不到 token，匿名读会退回 60 次/小时。

> App 的 client secret **不要**放进页面。它只存在令牌端点里，见下方
> [令牌端点](#令牌端点)。

### 2. 安装

```sh
pnpm add @aifire/gitalk          # 无框架
pnpm add @aifire/gitalk-react    # React
pnpm add @aifire/gitalk-vue      # Vue
```

不想构建的话，直接引 CDN：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@aifire/gitalk@latest/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/@aifire/gitalk@latest/dist/gitalk.js"></script>
```

> 首次发布完成前，npm 上还没有这些包，请先按 [开发](#开发) 从源码构建。

### 3. 渲染

**无框架**

```html
<div id="gitalk-container"></div>
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv1.xxxxxxxxxxxx',   // 示例值：换成你 App 的 Client ID
    owner: 'octocat',               // 存放评论的仓库所有者
    repo: 'demo-repo',              // 只写仓库名，不要写 `octocat/demo-repo`
    admin: ['octocat'],             // 谁可以在首次访问时创建 thread
    number: 42,                     // 本页对应的 discussion number
    proxy: 'https://my-niubi-gitalk.octocat.workers.dev' // 部署打印出来的 origin，不要带路径
  })
  gitalk.render('gitalk-container')
</script>
```

**React**

```tsx
import { Gitalk } from '@aifire/gitalk-react'
import '@aifire/gitalk/style.css'

export function Comments() {
  return (
    <Gitalk
      options={{
        clientID: 'Iv1.xxxxxxxxxxxx',
        owner: 'octocat',
        repo: 'demo-repo',
        admin: ['octocat'],
        number: 42,
        proxy: 'https://my-niubi-gitalk.octocat.workers.dev'
      }}
    />
  )
}
```

**Vue**

```vue
<script setup lang="ts">
import { Gitalk } from '@aifire/gitalk-vue'
import '@aifire/gitalk/style.css'

const options = {
  clientID: 'Iv1.xxxxxxxxxxxx',
  owner: 'octocat',
  repo: 'demo-repo',
  admin: ['octocat'],
  number: 42,
  proxy: 'https://my-niubi-gitalk.octocat.workers.dev'
}
</script>

<template>
  <Gitalk :options="options" />
</template>
```

## 配置项

| 配置 | 默认 | 说明 |
|---|---|---|
| `clientID` | — | 你的 GitHub App client id |
| `owner`, `repo` | — | 存放 discussion 的仓库 |
| `admin` | `[]` | 允许创建 thread 的用户 |
| `backend` | `'discussions'` | 1.x 老用户可传 `'issues'` |
| `number` | — | discussion 编号。**推荐**：省掉一次标题扫描 |
| `id` | `location.pathname` | 未给 `number` 时用于定位页面的标识 |
| `category` | — | 创建 discussion 时使用的分类 |
| `perPage` | `10` | 每页条数 |
| `proxy` | 本项目自己的端点 | 你的代理 origin。实际上必须自建：见[令牌端点](#令牌端点) |
| `language` | `navigator.language` | 沿承 1.x 的 11 种语言 |

## 令牌端点

`github.com/login/oauth/access_token` **不返回 `Access-Control-Allow-Origin`**，
device flow 同样被 CORS 挡住，所以**纯静态页面无法自己完成 OAuth 交换**。
必须有个服务端持有 client secret。

Gitalk 内置的默认值是本项目自己跑的端点，它只服务本项目自己的站点：来源白名单不对外开放，
其他域名在请求到达 GitHub 之前就被 CORS 拒绝。**请自己部署一份** —— 一条命令，免费额度，
约一分钟：

```sh
npx github:gitalk/deploy -c .env -t cloudflare
```

也支持 **CloudBase**（`-t cloudbase`，需要 CloudBase 环境与腾讯云密钥），以及自托管 Node。
完整步骤 —— 仓库准备、App 权限、**把 App 安装到你的仓库**、凭据、`.env`、callback URL
—— 只维护在一处：**[deploy CLI 的 README](packages/gitalk-deploy/README-CN.md)**。
只有那份文件列步骤，本文不重复。

把它打印出来的 origin 传进来：

```js
{ proxy: 'https://my-niubi-gitalk.octocat.workers.dev' }
```

端点只会看到 OAuth code 或加密后的会话——浏览器里从不出现 client secret，
访客的原始 token 也不会出现在 URL 中。

## 额度

| 访客状态 | 走的接口 | 额度 |
|---|---|---|
| 未登录，配了 `proxy` 且 App 已安装 | 经你的 proxy 走规范化 GraphQL 读，用 installation token | 5000 次/小时 |
| 未登录，没配 proxy 或 App 没安装 | 浏览器直连 GitHub REST | **每 IP 60 次/小时** |
| 已登录 | 用访客自己的 token 走 REST / GraphQL | 5000 次/小时 |

配了 `proxy` 时，匿名读走 proxy 的规范化 GraphQL，花 installation token 的 5000 次/小时；
这条路过不去（proxy 不可达、App 没安装、仓库私有）时，组件退回浏览器直连的 REST 读，
不需要凭据，计入匿名每 IP 额度。写操作必须走 GraphQL（GitHub 没有给 discussions 提供
REST 写接口），所以发评论必须登录。实测矩阵见 [docs/tech.md §2.1](docs/tech.md)。

会话有效期 30 天；App 若开启了令牌过期，Worker 会自动静默续期，
见 [docs/tech.md §3.7](docs/tech.md)。

## 从 1.x 迁移

老评论存在 Issues 里，不会出现在 Discussions。传 `backend: 'issues'`
即可继续读写：

```js
{ backend: 'issues' }
```

但 `clientID` 必须换：1.x 用的是 OAuth App，2.0 需要 GitHub App。

## 相比 1.x 的变化

| | 1.x | 2.0 |
|---|---|---|
| 存储 | GitHub Issues | **GitHub Discussions**（Issues 可选） |
| 工具链 | webpack 3 · Babel 6 · Preact 8 | Vite 8 · TypeScript 7 · Preact 11 |
| 鉴权 | `clientSecret` 写进页面 + 第三方 CORS 代理 | 自部署 edge function，**浏览器不含密钥** |
| 发版 | standard-version | release-please |
| 产物 | 仅 UMD | ESM + IIFE + React + Vue |

所有 API 行为结论均有实测记录，详见 [docs/tech.md](docs/tech.md)。

## 开发

```sh
pnpm install
pnpm dev            # 落地页 + 实时评论组件
pnpm test           # 68 个测试
pnpm build          # 全部包
pnpm typecheck
```

发版由 release-please 完成：合并它开的 Release PR，CI 即通过 OIDC 发布到 npm，
见 [.github/workflows/publish.yml](.github/workflows/publish.yml)。

## 许可证

MIT
