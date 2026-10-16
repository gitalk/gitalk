# Gitalk 2.0 技术设计

> 面向开发者。API 行为结论来自对 GitHub 生产环境的实测（含 GraphQL introspection），
> 未实测的条目标注 ⚠️。端点部署见 [tech-deploy.md](./tech-deploy.md)，
> 使用者操作见 [guide.md](./guide.md)。

---

## 1. 概述

相对 v1 的三条主线：

1. **工具链**：webpack 3 + Babel 6 + Preact 8 → Vite + TypeScript + Preact 11 + Vitest。
2. **后端**：**GitHub Discussions 为默认**，Issues 保留为选项。
3. **认证**：不再有 secret 进入浏览器，不再依赖第三方 CORS 代理，改为**部署在你自己 origin 下的端点**。

产出形态：无框架 IIFE、React 组件、Vue 组件，外加落地页 `gitalk.github.io`。

### 1.1 为什么默认 Discussions

v1 把页面 id 编码成 **issue label**，而 GitHub 对 label 名有 **50 字符**硬限制——长 URL 直接
`Validation Failed`（v1 头号线上 bug，gitalk/gitalk#423）。Discussions 的 title 无此限制。
其次，评论不该污染仓库的 issue 列表。

---

## 2. 后端：Discussions 默认 + Issues 可选

### 2.1 匿名读取能力（实测）

| Endpoint | 匿名 |
| --- | --- |
| `GET /repos/{o}/{r}/discussions`、`.../discussions/{n}` | ✅ 200，`ACAO: *` |
| `GET .../discussions/{n}/comments` | ✅ 200 |
| `GET .../issues/{n}/comments`、`GET .../issues?labels=X` | ✅ 200 |
| `GET .../discussions/categories` | ❌ 404（需认证） |
| `POST /graphql` | ❌ **403，`x-ratelimit-limit: 0`** |

**GraphQL 的匿名额度字面为 0**，所以「登录走 GraphQL、匿名降级 REST」是**必需架构**，不是优化。

### 2.2 Discussions 写必须走 GraphQL

`POST .../discussions`、`.../discussions/{n}/comments`、`.../comments/{id}/reactions`
**路由不存在**——404，即便带有效 token（不是鉴权失败）。

**结论：读可匿名 REST；写必须 GraphQL。** 与 giscus 的架构选择一致。

### 2.3 两个后端的数据形状不一致（易踩坑）

同一讨论实测：

```
REST    GET .../discussions/442/comments  → 3 行
        顶层 ×2 + 一条 parent_id 指向顶层的回复，回复与顶层混在同一个列表里
GraphQL comments(first:10)                → totalCount = 2（只算顶层），回复在 comment.replies 里
```

⚠️ 不要混用两个后端并假设同构。

对策：adapter 内部统一成「**顶层 + 一层回复**」的树。REST 侧按 `parent_id` 归组；
父级不在本批次的回复**上提为顶层**而不是丢弃。不做无限嵌套——一级回复够博客场景。

分页语义同样不一致：REST 是 `page`/`per_page` 偏移式（上限 100），没有 cursor，`hasNextPage`
由本批长度推导；GraphQL 是游标式。

### 2.4 node id 与 databaseId 必须同时保留

点赞、回复、`discussionId` 一律要 **GraphQL node id**（`DC_kwDO…` / `D_kwDO…`），
而 REST 的 `id` 是数字。REST 同时返回 `node_id`，与 GraphQL `id` 相等——这是匿名状态下
仍能拿到后续 mutation 所需 id 的原因。类型层面显式区分两个字段，不允许混用。

### 2.5 页面 → thread 的寻址

1. **显式 `number`（推荐）**：`GET .../discussions/{n}`。确定性、无搜索索引延迟、一次请求。
   生产配置应始终给 `number`。
2. **按 term 兜底（Discussions，匿名）**：GraphQL 搜索不可用（额度 0），而 REST
   `search/issues` **不索引 Discussions**（`type:discussions` 恒为 0）。所以匿名只能
   `GET .../discussions?per_page=100&page=N` 拉列表、在客户端比对 title，最多 5 页。
3. **Issues**：`GET .../issues?labels=<labels>,<term>&state=all`，label 过滤匿名可用，一次请求。

> 自动建楼时若拿不到 `number`，必须先按 title 找到已有 discussion——上面第 2 条就是它慢的原因。

### 2.6 写操作 mutation

`addDiscussionComment{body, discussionId, replyToId?}`、`updateDiscussionComment`、
`deleteDiscussionComment`、`createDiscussion`、`addReaction`/`removeReaction{subjectId, content}`。
**没有独立的 `addDiscussionReply`**——回复就是带 `replyToId` 的 `addDiscussionComment`
（giscus 的 `addDiscussionReply.ts` 也只是这个 mutation 的别名）。表情用 `reactionGroups`，
`ReactionContent` 共 8 种。

创建讨论走 GraphQL `createDiscussion`（经 proxy 转发，需要 `discussions: write`）。
`categoryId` 是必填，未配 `category` 时回退到仓库的第一个分类。

### 2.7 OAuth 写权限（实测）

经典 OAuth App 的 `gho_` 用户 token、scope `repo`（公开仓库 `public_repo` 亦可），即可完成
`createDiscussion` / `addDiscussionComment`（含 `replyToId`）/ `addReaction` / `removeReaction`，
匿名 REST 随后能读回。

**不存在 `write:discussion` / `read:discussion` 这类独立 scope**——Discussions 权限挂在
`repo` / `public_repo` 下，也没有读写分离的 OAuth scope。所以**不必改成 GitHub App**，
需要改的只是 secret 的存放位置。

---

## 3. 认证

### 3.1 v1 的两个硬伤

1. OAuth code 与 `client_secret` 被 POST 到第三方 CORS 代理 `cors-anywhere.azm.workers.dev`。
2. 为了把匿名限额从 60/hr 抬到 5000/hr，v1 要求把 `clientSecret` 写进静态页面——
   GitHub 官方明确禁止（"Never include your app's client secret in client-side code"）。

### 3.2 纯静态方案拿不到 token

`github.com/login/oauth/access_token` 与 `/login/device/code` **都不返回
`Access-Control-Allow-Origin`**，OPTIONS 预检 404（对照组 `api.github.com/*` 返回 `ACAO: *`）。
Device Flow 确实不需要 `client_secret`，但同样被 CORS 挡住，**无法在浏览器内使用**。

### 3.3 方案：用户自建端点

| 方案 | secret 进浏览器 | 匿名读 | 结论 |
| --- | --- | --- | --- |
| 浏览器内 Device Flow | ❌ | REST 60/hr | ❌ CORS 阻断 |
| **自建 edge function**（源码随仓库分发） | ❌ | GraphQL 5000/hr | ✅ 默认安装路径 |
| 沿用 v1 共享代理 | ✅ 泄露 | 5000/hr | ❌ 废弃 |
| 纯静态（匿名读 + 访客自填 PAT） | ❌ | REST 60/hr | ⚠️ 无基建兜底 |

端点（`packages/proxy-core`）只做三件事：

1. 用 secret 完成 `code → token` 交换；
2. 签发 GitHub App installation token，供匿名 GraphQL 读取（5,000/hr）；
3. 转发 GraphQL mutation（带用户的 `Authorization` 时原样转发，写操作归属真实用户）。

它比 giscus 的中心化代理更好：**端点部署在用户自己的 origin 下，第三方看不到流量**。
三种部署目标、凭据模型与 CloudBase 的坑见 [tech-deploy.md](./tech-deploy.md)。

### 3.4 浏览器里存的是会话，不是只有令牌

```
浏览器                     端点（proxy-core）            GitHub
  ├─ /oauth/authorize ────►│
  │                        ├─ 302，拼 redirect_uri + state ──►│ 授权页
  │◄──── /oauth/callback?code=…&state=… ─────────────────────┤
  │                        ├─ code + client_secret ─────────►│
  │                        │◄──── access_token(+refresh) ────┤
  │◄─ 302 回原页面 ?gitalk_session=<AES-GCM 密文> ───────────┤
  ├─ 取出 session，POST /oauth/token ──►│
  │◄──── { access_token, session? } ────┤
  ├─ 存会话；把 gitalk_session 从地址栏 replaceState 抹掉
```

前台**不自己拼 GitHub 授权 URL**：`redirect_uri` 必须与 App 注册值完全一致、`state` 要能带回
原页面，这两件事只有端点同时知道（它知道自己的公开 origin，也持有 secret）。放两份实现必然漂移，
一旦漂移就是「填对了也登不上」这类难查的故障。

| 选择 | 理由 |
| --- | --- |
| 跳 `<端点>/oauth/authorize`，不自己拼 GitHub URL | redirect_uri 与 state 只有端点同时知道 |
| `getToken()` 对过期令牌返回 `null` | 发死令牌只会换 401；`null` 可回退匿名读（仍有 5000/hr） |
| session 一落地就从地址栏 `replaceState` 抹掉 | URL 会进历史、被分享、经 Referer 外泄 |
| 续期因**网络**失败保留会话，仅服务端拒绝时丢弃 | 一次网络抖动不该让人重新登录 |
| 授权 URL 不发 `scope` | GitHub App 权限由注册信息决定，`scope` 会被忽略 |
| 令牌过期时 `/oauth/token` 顺带返回**轮换后的新会话** | GitHub 每次续期都轮换 refresh_token，不换则下次续期失败 |

会话与令牌都在 localStorage（`GT_SESSION` / `GT_ACCESS_TOKEN`），但**续期只靠会话**：
token 过期（App 开启 "Expire user authorization tokens" 后为 8 小时）后由会话静默换新，
访客无感。当前 App 未开启该选项，所以续期路径平时不触发——留着是为了将来开启时不必改代码。

端到端测试：`packages/proxy-core/src/oauth.test.ts`（授权 → 回调 → 令牌全流程，含轮换与失败分支）、
`packages/core/src/auth.test.ts`（前端侧过期判定与会话轮换）。

### 3.5 CORS 必须放行 Authorization（实测修复）

预检响应原先只有 `Access-Control-Allow-Headers: Content-Type`。匿名读不带 `Authorization`，
所以端点看起来一直是健康的；**登录后的写操作则全部卡在预检**。现在是
`Authorization, Content-Type` 与 `Access-Control-Allow-Methods: GET,POST,OPTIONS`。

> 教训：改 CORS 后必须用**带 `Authorization` 的预检**验证，否则等于没测。

### 3.6 端点 URL 是一处连锁依赖

```
wrangler.toml 的 name + 账号的 workers.dev 子域
        ↓
https://gitalk-proxy.<子域>.workers.dev
        ├─ ① packages/core/src/auth.ts  DEFAULT_PROXY
        ├─ ② GitHub App 的 Redirect URI ＝ <URL>/oauth/callback
        └─ ③ 文档中所有出现该地址处
```

`*.workers.dev` 子域**全局唯一**，且无法通过 API 改名（`PUT /accounts/{id}/workers/subdomain`
返回 `409 / 10036`）。名字被占用时 ① 和 ② 必须**同步**改——只改一处会让登录停在 GitHub 的
错误页，不容易联想到是地址不匹配。

**优先绑自定义域名**：workers.dev 子域与账号绑定，迁移账号或子域被回收都会让已发布的 widget
集体失效。自部署者用 `options.proxy` 指向自己的端点即可绕开整条链。

---

## 4. Markdown 渲染

**不打包 markdown 解析器。** REST 加 `Accept: application/vnd.github.v3.full+json` 就能拿到
服务端渲染好的 `body_html` / `body_text`（Discussions 与 Issues 都实测可用）。唯一需要本地渲染的
场景是**未提交草稿的预览**，用 `POST /markdown`（匿名可用，实测），零 bundle 成本。

实现细节：REST 读一律带 `application/vnd.github.v3.full+json`，请求头固定
`X-GitHub-Api-Version: 2026-03-10`。

⚠️ 代码里**没有**监听 `Deprecation` / `Sunset` 响应头（早先设计里写了，未实现）。

---

## 5. 速率限制

| | 限额（实测） |
| --- | --- |
| 匿名 REST `core` | **60/hr / IP** |
| 认证 REST | 5,000/hr |
| 认证 GraphQL | **5,000 pts/hr / user token** |
| 匿名 GraphQL | 0 |

60/hr 按**访客 IP** 计，NAT／公司代理后的所有访客共享额度。客户端对 429 与
`403 + X-RateLimit-Remaining: 0` 都抛 `RateLimitError`，UI 提示登录。

**未实现（可选优化）**：ETag 条件请求。认证路径下 304 不计主限额（实测），但前提是两次请求的
`Accept` 完全一致，否则 ETag 不同、返回 200。代码里尚未接入，不要当成限额保证。

---

## 6. 包结构与技术栈

```
packages/
  core/             Preact 11 + hooks：数据层 + 框架无关 UI（另有 IIFE 出口）
  react/            React 包装器（peerDep react >=18）
  vue/              Vue 3 包装器（peerDep vue >=3.4）
  proxy-core/       平台无关 handle(request, env, ctx) → Response
  proxy-worker/     Cloudflare Workers 入口
  proxy-node/       Node http ↔ Web Request 适配 + Dockerfile
  proxy-cloudbase/  腾讯云 CloudBase Web 函数（逐字节复用 proxy-node 的 dist/server.js）
apps/landing/       Vite + React + Tailwind v4 落地页
```

| 用途 | 选型 | 版本 |
| --- | --- | --- |
| 核心渲染层 | Preact | 11.0.1 |
| 构建 | Vite（lib mode，多 entry） | 8.3.4 |
| 语言 | TypeScript | 7.0.2 |
| 测试 | Vitest + jsdom | 5.0.5 |
| 落地页 | React / Tailwind | 19.3.1 / 4.3.3 |
| 发版 | release-please（GitHub Action `googleapis/release-please-action@v5`） | — |

**Preact 11 的两个实际影响**：只发布 ESM（v1 那种 `<script>` 挂 `window.Gitalk` 的 UMD 产物
要我们自己用 Vite 产 IIFE）；`useRef` 必须传初值。

**三种用法**：IIFE 的 `new Gitalk({...}).render('#el')`、React 的 `<Gitalk options={...} />`、
Vue 的 `<Gitalk :options="..." />`。Preact 打包在内，不与宿主的 React/Vue 版本冲突。

---

## 7. 评论组件（v2.2 设计稿改造）

视觉语言：区域卡片、扁平行 + 发丝分隔、嵌套回复走品牌色轨道、36px 圆形头像、操作区从右上角
下移到正文下方（药丸）。主题全部来自 `--gt-*` token，暗色是 `[data-theme='dark']` 下的
**纯 token 覆盖**，不是第二份样式表。

**刻意偏离设计稿的一处**：暗色下主按钮仍用品牌色 `--gt-color-main`（#1E4FFF），
不跟随 `--gt-color-accent` 的提亮，以保证对比度。

**公开契约不变**：`options` 的全部字段、`.gt-*` class 名（评论区块 12 个，如
`.gt-comment-actions`、`.gt-comment-replies` 等）、v1/v2.0 的 `--gt-*` 变量名，全部保持原样，
由 `packages/core/src/redesign.test.tsx` 的契约测试锁住。

### 7.1 评论计数口径（已修）

`state.comments` 是**顶层数组**，回复挂在各自的 `.replies` 里。计数必须按「顶层 + 回复」算
（`widget.tsx` 里的 `reduce`）；只数顶层会让 GitHub 列表显示 3、组件显示 2。

---

## 8. i18n

字典自 v1 原样迁移，`counts` 等条目带 v1 的 `单数 |||| 复数` 分隔符。`t(name, vars, pluralCount)`
**在插值前**按计数选形态，再填 `%{…}`——顺序反了会把 `||||` 原样渲染到页面上（曾经的线上表现）。

⚠️ 只支持两形态；波兰语字典是三形态（`1 |||| 2–4 |||| 5+`），第 5 条以上会退化成第二形态。

---

## 9. 发版：release-please

`release-please-config.json` + `.release-please-manifest.json`，由
`.github/workflows/publish.yml` 驱动：Conventional Commits 推导 semver、以 PR 形式维护
manifest 与 CHANGELOG、**三个包各自独立版本**但**统一 tag**（`include-component-in-tag: false`
→ `v2.3.0`）。发布走 npm OIDC Trusted Publishing + provenance，仓库不留长期令牌。

已发布：`@aifire/gitalk@2.3.0`、`@aifire/gitalk-react@2.2.1`、`@aifire/gitalk-vue@2.2.1`。

### 9.1 版本号注入

`__GITALK_VERSION__` 由 Vite `define` 注入，**三处都从 `packages/core/package.json` 读**：
`packages/core/vite.config.ts`、`packages/core/vite.iife.config.ts`、`apps/landing/vite.config.ts`。

（曾经在 core 的配置里硬编码，滞后了三个版本；落地页则完全没定义它，组件显示的是 fallback 字符串。）

---

## 10. 落地页与部署

落地页发在**裸域名** `https://gitalk.github.io/`。只有名为 `<org>.github.io` 的仓库能服务裸域名，
所以站点推到独立仓库 `gitalk/gitalk.github.io` 的 `gh-pages` 分支；放在 `gitalk/gitalk` 自己的
`gh-pages` 只会得到 `https://gitalk.github.io/gitalk/`。

- `GITHUB_TOKEN` 只能写当前仓库 → 用**只对该仓库可写的 SSH deploy key**（`GH_PAGES_DEPLOY_KEY`），
  而不是账号级 PAT。见 `.github/workflows/deploy-pages.yml`。
- 目标仓库的 Pages source 必须指向 `gh-pages`（原本从 `master` 构建，只推分支不会改变线上站点）。
- 落地页 `base: './'`，同一份构建在裸域名与子路径下都能用。
- 仓库默认分支是 `main`（release-please 去 `master` 找 manifest 会失败）。

demo 可在两个端点间切换（`DEMO_ENDPOINTS`），靠 `key={endpoint.proxy}` 强制组件重新挂载。

⚠️ **遗留安全项**：`gitalk/gitalk.github.io` 的 `master` 分支 `index.html` 仍硬编码着旧 OAuth App
的 `clientSecret`（公开仓库，任何人可读）。应轮换或删除该 App。

---

## 11. 已知限制

- Discussions 后端没有创建路径（§2.6）。
- i18n 只支持两形态复数（§8）。
- ETag 条件请求未接入（§5）。
- 仅支持一层回复嵌套（§2.3）。
