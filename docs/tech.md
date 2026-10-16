# Gitalk 2.0 技术设计文档

> 状态：设计定稿（2026-10）
> 本文所有 API 行为结论均来自对 GitHub 生产环境的**实际请求与 GraphQL introspection**，非文档推测。
> 未能验证的条目统一标注为 ⚠️ 未验证。

---

## 0. 摘要

Gitalk 2.0 是一次从工具链到认证模型的重写。三条主线：

1. **工具链现代化**：webpack 3 + Babel 6 + Preact 8 → Vite 8 + TypeScript 7 + Preact 11 + Vitest 5。
2. **后端切换**：GitHub Issues → **GitHub Discussions 为默认**，Issues 保留为可选。
3. **修复 v1 的认证设计缺陷**：不再有 secret 进入浏览器，不再依赖第三方 CORS 代理。

产出形态：无框架依赖用法、React 组件、Vue 组件。另有全新落地页部署至 gh-pages 分支。

---

## 1. v1 的技术债

| 项 | v1 现状 | 问题 |
|---|---|---|
| 渲染层 | Preact 8.1.0 + preact-compat | 2017 年版本，官方已移至 `legacy` dist-tag |
| 构建 | webpack 3 + Babel 6 + extract-text-webpack-plugin | 工具链全部停止维护 |
| 语言 | 无 TypeScript，`typings/index.d.ts` 手写维护 | 类型与实现脱节，必然腐坏 |
| 网络层 | axios 0.19.2 | 存在已知安全通告 |
| 认证 | `clientID + clientSecret` 内嵌前端 + 第三方 CORS 代理 | **设计缺陷，见 §3** |
| 页面寻址 | 把 page id 编码成 **issue label** | **触发 v1 头号 bug，见 §1.1** |
| 发版 | standard-version | 替换为 release-please |

### 1.1 v1 的头号线上 bug 正是 Discussions 的价值所在

实测：gitalk/gitalk 仓库自身 discussion **#423「Error: Validation Failed.」** 的根因是
**label 名称超过 50 字符**——v1 把页面 id 编码成 label，GitHub 硬性限制 50 字符，长 URL 直接失败。

Discussions 的 **title 无此限制**。这也是默认切换到 Discussions 的第二个理由（第一个是语义）：
评论不应污染仓库的 issue 列表。

---

## 2. 后端：Discussions 默认 + Issues 可选

### 2.1 读取能力矩阵（实测）

匿名请求（无任何 token）：

| Endpoint | 结果 |
|---|---|
| `GET /repos/{o}/{r}/discussions` | ✅ 200，`ACAO: *`，60/hr |
| `GET /repos/{o}/{r}/discussions/{n}` | ✅ 200 |
| `GET /repos/{o}/{r}/discussions/{n}/comments` | ✅ 200 |
| `GET /repos/{o}/{r}/issues/{n}/comments` | ✅ 200 |
| `GET /repos/{o}/{r}/issues?labels=X`（按 label 过滤） | ✅ 200 |
| `GET /repos/{o}/{r}/discussions/categories` | ❌ 404（需认证） |
| `POST /graphql`（无 Authorization） | ❌ **403，`x-ratelimit-limit: 0`** |

> **GraphQL 完全不支持匿名**——限额字面为 0，无任何匿名 GraphQL 额度。
> 这决定了**双通道数据层是必需架构，而非可选优化**：
> 已登录走 GraphQL（5000 pts/hr），匿名必须降级走 REST（60/hr）。

### 2.2 Discussions REST 只支持读，写必须走 GraphQL（实测）

- `POST /repos/{o}/{r}/discussions`、`POST .../discussions/{n}/comments`、
  `POST .../discussions/comments/{id}/reactions` → **全部 404，即便带有效 token**。
  路由不存在，不是鉴权失败。

**结论：读可匿名 REST；写必须 GraphQL。** 这是 giscus 的架构选择，也是我们的。

### 2.3 REST 与 GraphQL 的 replies 语义不一致（易踩坑）

同一讨论 `gitalk/gitalk#442` 实测对比：

```
REST   GET /repos/gitalk/gitalk/discussions/442/comments   → 3 行
       id=523955   parent_id=null    child=1     ← 顶层
       id=913250   parent_id=null    child=0     ← 顶层
       id=3485634  parent_id=523955  child=0     ← 回复，混在同一列表

GraphQL  repository{ discussion(number:442){ comments(first:10){ ... } } }
       totalCount = 2, 两条 replyTo = null
       → 只有顶层；回复需通过 comment.replies 取
```

⚠️ **不要混用两个后端并假设同构**：GraphQL 的 `totalCount` 只算顶层，REST 的行数算全部。

设计对策：数据层内部统一为「顶层 + 一层回复」的树形结构，由 adapter 抹平两者差异。
REST 通道需自行按 `parent_id` 归组；GraphQL 通道直接读 `replies(last:100)`。
不支持无限嵌套——一级回复足够博客评论场景，与 giscus 一致。

### 2.4 GraphQL 数据形状（introspection + 实跑）

```graphql
query ($owner: String!, $name: String!, $number: Int!, $first: Int, $after: String) {
  repository(owner: $owner, name: $name) {
    discussion(number: $number) {
      id url locked title
      comments(first: $first, after: $after) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          id            # node id，点赞/回复必需
          databaseId    # 数字 id，稳定去重 key
          url bodyHTML bodyText
          author { login avatarUrl url }
          authorAssociation createdAt lastEditedAt deletedAt isMinimized
          viewerDidAuthor upvoteCount viewerHasUpvoted
          reactionGroups { content users { totalCount } viewerHasReacted }
          replies(last: 100) {
            totalCount
            nodes { id author { login avatarUrl url } viewerDidAuthor createdAt
                    url authorAssociation lastEditedAt deletedAt isMinimized
                    bodyHTML reactionGroups { content users { totalCount } viewerHasReacted }
                    replyTo { id } }
          }
        }
      }
    }
  }
}
```

Introspection 已确认的关键字段：`DiscussionComment` 具备
`id / databaseId / bodyHTML / bodyText / createdAt / deletedAt / isMinimized /
authorAssociation / replies / replyTo / isAnswer / viewerDidAuthor /
upvoteCount / viewerHasUpvoted / editor / includesCreatedEdit`。

⚠️ 注意：**`Discussion` 上没有 `viewerCanComment` 字段**（introspection 确认为不存在），
能否评论应用 `locked` 字段判断。

### 2.5 写操作 mutation（introspection 全部确认）

| Mutation | Input |
|---|---|
| `addDiscussionComment` | `{discussionId: ID!, body: String!, replyToId: ID, clientMutationId}` |
| `updateDiscussionComment` | `{commentId: ID!, body: String, ...}` |
| `deleteDiscussionComment` | `{id: ID!, ...}` |
| `createDiscussion` | `{repositoryId: ID!, categoryId: ID!, title: String!, body: String!, ...}` |
| `addReaction` / `removeReaction` | `{subjectId: ID!, content: ReactionContent}` |
| `markDiscussionCommentAsAnswer` 等 | Q&A 专用，2.0 不使用 |

不存在独立的 `addDiscussionReply` mutation——**回复就是带 `replyToId` 的 `addDiscussionComment`**
（giscus 里 `addDiscussionReply.ts` 也只是这个 mutation 的别名）。

`ReactionContent` 枚举：`THUMBS_UP THUMBS_DOWN LAUGH HOORAY CONFUSED HEART ROCKET EYES`。
建议用 `reactionGroups`（一次拿全 8 种表情）而非逐个 `reactions(content:)`。

### 2.6 ⚠️ node id 与 databaseId 必须同时保留

`addReaction` / `removeReaction` / `addUpvote` / `replyToId` / `discussionId` 一律要求
**GraphQL node id**（`DC_kwDO...` / `D_kwDO...`），而 REST 返回的 `id` 是数字。

**凡是点赞/回复入口，都必须持有 node id。** 这是 v1 用 `comment.gId` 字段绕过的坑，
2.0 要在类型层面显式区分两个字段，不允许混用。REST 的 `node_id` 字段即 GraphQL `id`，
可用于跨通道对齐。

### 2.7 页面 → discussion 的映射

两种寻址，按优先级：

1. **显式 `number`（推荐默认）**：`repository { discussion(number: N) }`。
   确定性、无搜索索引延迟、成本低。giscus 也优先走这条。
2. **按 term 搜索（自动建楼时兜底）**：giscus 的 `getDiscussion.ts` 构造

   ```
   repo:<repo 转小写> [category:"<name>"] in:title "<term>"
   ```

   然后 `search(type: DISCUSSION, last: 1, query: $query)`。

   注意两个坑：`repo:` **必须小写**（giscus issue #118，混用大小写与 `category:` 组合会出错）；
   term 需 JSON-stringify 加引号以安全处理空格。另有 `strict` 模式改用 SHA-256 + `in:body`。
   ⚠️ 搜索是索引驱动的，刚创建的 discussion 未必立即可查。

category id 是**仓库相关的 node id**，必须运行期通过 `discussionCategories(first:100)` 解析，
不可硬编码。

---

## 3. 认证 —— v1 最需要重构的一环

### 3.1 v1 的两个硬伤

1. **第三方 CORS 代理**：v1 默认把 OAuth code 与 `client_secret` POST 到
   `https://cors-anywhere.azm.workers.dev/...`——一个与项目无关的第三方服务器，
   同时能观察到你的 secret 和每位访客的 code。
2. **secret 必然公开**：为了用 Basic auth（`client_id:client_secret`）把匿名限额从
   60/hr 抬到 5000/hr，v1 要求把 `clientSecret` 写进静态页面。
   GitHub 官方速率限制文档对此有明确警告：

   > "Never include your app's client secret in client-side code or in code that runs on a user device."

### 3.2 关键结论：纯静态方案无法获取 token

所有获取 token 的路径都要经过 `github.com/login/oauth/access_token`，而该端点
**不返回 `Access-Control-Allow-Origin`**。实测：

| Endpoint | ACAO | OPTIONS 预检 |
|---|---|---|
| `github.com/login/device/code` | ❌ 无 | 404 |
| `github.com/login/oauth/access_token` | ❌ 无 | 404 |
| `api.github.com/*`（对照组） | ✅ `*` | 正常 |

对照实验证明测量方法可靠——同样的手法下 `api.github.com` 确实返回 `ACAO: *`。

**因此 Device Flow 也无法在浏览器中使用。** 这一点推翻了我最初的假设。
Device Flow 确实**不需要 client_secret**（实测：仅传 `client_id` 即返回真实
`device_code` / `user_code` / `interval`；官方文档错误码表亦明文写着
"The `client_secret` is not needed for the device flow"），
但它同样被 CORS 挡住，因而无法单独拯救我们的场景。

> 前提：OAuth App 需在设置中显式开启 **Enable Device Flow**，否则返回
> `{"error":"device_flow_disabled"}`（已复现）。Device flow 的两个端点无论成功失败
> 均返回 HTTP 200，错误体在 JSON 里。

### 3.3 方案对比与选型

| 方案 | secret 进浏览器 | 匿名读 | 用户自建服务 | 裁决 |
|---|---|---|---|---|
| **A. 浏览器内 Device Flow** | ❌ | REST 60/hr | 不需要 | ❌ **不可行**（CORS 证实阻断） |
| **B. 用户自建 Edge Function**（源码随仓库分发） | ❌ | GraphQL 5000/hr | 一键部署约 30 秒 | ✅ **推荐** |
| **C. 沿用 v1 共享代理** | ✅ 泄露 | 5000/hr | 不需要 | ❌ 废弃 |
| **D. 纯静态降级**（匿名读 + 访客自填 PAT） | ❌ | REST 60/hr | 不需要 | ⚠️ 低流量兜底 |

**决定：B 为默认安装路径，D 为无基建兜底。**

`packages/proxy-worker/` 提供一个极小的 edge function，只做三件事：

1. 用 secret 完成 `POST /login/oauth/access_token` 的 code → token 交换；
2. 签发 GitHub App installation token 供匿名 GraphQL 读取（5,000/hr）；
3. 转发 GraphQL mutation。

它比 giscus 的中心化代理更好：**代理部署在用户自己的 origin 下，
任何第三方都看不到流量**。附带 Cloudflare Workers / Vercel / Netlify 三种一键部署说明。

⚠️ 未验证（不臆断）：

- PKCE 仅凭 `code_challenge` 而无 `client_secret` 能否完成交换——需要跑通一次真实同意流程。
  文档中 PKCE 被描述为"强烈推荐"而非 secret 的替代品，故**不作为设计依据**。
- `client_id`/`client_secret` 作为 query parameter 的官方状态——文档已无相关表述，
  实测结果为被忽略（仍 60/hr），判定为「经验上失效、官方未声明」。

### 3.4 OAuth 写权限（实测，非推断）

`gh auth token` 是 `gho_` 前缀的**经典 OAuth App 用户 token**，scope 为
`gist, read:org, repo, workflow`（由 `X-OAuth-Scopes` 确认）。用它实测完成整条写链路：

- `createDiscussion` ✅
- `addDiscussionComment` ✅
- 带 `replyToId` 的回复 ✅（`replyTo.id == parent`）
- `addReaction(HEART)` / `removeReaction` ✅
- 匿名 REST 随后成功读回上述内容 ✅

**结论：OAuth App + `repo` scope（公开仓库可用 `public_repo`）即拥有 Discussions 完整读写权。**
不存在 `write:discussion`／`read:discussion` 这类独立 scope——Discussions 权限挂在
`repo` / `public_repo` 下，也没有读写分离的 OAuth scope。

所以 **2.0 无需改成 GitHub App**，沿用 v1 的 OAuth App 流程即可支持 Discussions 写；
需要改的只是 secret 的存放位置（放进 Worker，而非浏览器）。

### 3.5 giscus 的做法及其代价

giscus **不是 serverless**：它是部署在 Vercel 上的 Next.js 应用，同时用了两种凭据。

- **匿名读**：浏览器 → `/api/discussions` → `getAppAccessToken()` 在服务端用 RSA 私钥签 JWT
  换 installation token → GraphQL。token 永不进浏览器。
- **登录**：重定向流，secret 由 giscus.app 持有，token 经 AES 加密成 session 写入 localStorage。

这条路用户体验很好，但**依赖中心化服务**。Gitalk 2.0 保持「无我们自己的后端」这一核心卖点，
因此选 B 而非复刻 giscus。

### 3.6 托管端点的 URL 是一处连锁依赖

方案 B 自带了「项目得自己托管一个端点」的代价，而这个端点的地址牵动三处配置：

```
wrangler.toml  name = "gitalk-proxy"
        +
Cloudflare 账户注册的 workers.dev 子域
        ↓
最终 URL  https://gitalk-proxy.<子域>.workers.dev
        ↓
① packages/core/src/auth.ts  DEFAULT_PROXY
② GitHub App 的 Redirect URI ＝ <URL>/oauth/callback
③ 文档中所有出现该地址处
```

**`*.workers.dev` 子域是全局唯一的**（跨所有 Cloudflare 账号），因此「能否拿到
`gitalk` 这个子域」不由我们决定。子域是**账号级**资源，可能在注册 Worker 之前就已存在。

> **勘误**：本节早先据 `error code: 1042` 推断「子域尚未注册」，该推断**不成立**。
> 在一个已注册的子域上访问不存在的 Worker 同样返回 1042——它只说明该主机名没有
> Worker 在服务。查实际子域请用
> `GET /accounts/{id}/workers/subdomain`；`PUT` 同一端点会返回
> `409 / 10036`，即**子域无法通过 API 改名**。

若 `gitalk` 已被占用，① 和 ② 必须同步改——**只改一处会导致登录在 OAuth 回调处断掉**，
而且症状是停在 GitHub 的错误页，不容易联想到是地址不匹配。

**建议：优先绑自定义域名**（`routes`），而不是依赖 `*.workers.dev`。
workers.dev 子域与账号绑定，迁移账号或子域被回收都会让已发布的 widget 集体失效；
自定义域名可控得多。自部署者用 `options.proxy` 指向自己的端点即可绕开整条链。

面向使用者的操作步骤见 [docs/guide.md](./guide.md) 第 3 步。

### 3.7 浏览器里存的是会话，不是令牌

#### 三个组件各管一段

```
浏览器                    端点（proxy-core）               GitHub
  │                          │                              │
  ├─ 跳转 /oauth/authorize ──►│                              │
  │                          ├─ 302，拼 redirect_uri ──────►│  授权页
  │                          │     和 state（不含 scope）    │
  │◄──────── 回到 /oauth/callback?code=…&state=… ───────────┤
  │                          ├─ 用 code + client_secret ───►│
  │                          │◄──── access_token ───────────┤
  │                          │      (+ refresh_token)       │
  │◄─ 302 回原页面，带 ?gitalk_session=<密文> ───────────────┤
  ├─ 前端取出 session、POST /oauth/token ──►│                │
  │                          ├─ 解封会话；过期则续期 ──────►│
  │◄──── { access_token, session? } ────────────────────────┤
  ├─ 存会话；把 gitalk_session 从地址栏抹掉                  │
```

**为什么前台不自己拼 GitHub 的授权 URL**：`redirect_uri` 必须与 App 注册值完全一致，
`state` 必须能带回原页面。这两件事只有端点同时知道（它知道自己的公开 origin，也持有 secret）。
放在前台就会有两份实现，一旦漂移就是「填对了也登不上」这类难查的故障。


OAuth 往返结束后，Worker 不把 GitHub 的 access token 交给页面，而是给一个
**AES-GCM 封存的会话**（`?gitalk_session=…`）。前端拿它换 token，并且**只持久化会话**。

这个区分不是洁癖，是续期的前提：

- **token 会过期**（App 开启 "Expire user authorization tokens" 后为 8 小时）
- **会话里有 `refresh_token`**，能在令牌失效后静默换新的，访客无感

若前端只存 token（2.0 早期就是这样），令牌一过期就只剩「重新登录」一条路。
现在 `/oauth/token` 会在令牌过期时自动续期，并把**轮换后的新会话**一并返回，
前端替换掉旧的——GitHub 每次续期都轮换 `refresh_token`，不换就等于下次续期失败。

几个刻意的选择：

| 选择 | 理由 |
| --- | --- |
| 前端跳 `<proxy>/oauth/authorize`，不自己拼 GitHub URL | `redirect_uri` 与 `state` 只有 Worker 同时知道（它知道自己的公开 origin），放两份实现必然漂移 |
| `getToken()` 对已过期令牌返回 `null` | 发死令牌只会换来 401；返回 `null` 可回退到匿名读（仍有 5000/hr） |
| session 一落地就从地址栏 `replaceState` 抹掉 | URL 会进历史记录、被分享、经 Referer 外泄 |
| 续期因**网络**失败时保留会话，仅 401 时丢弃 | 一次网络抖动不该让人重新登录 |
| 授权 URL 不发 `scope` | GitHub App 的权限由注册信息决定，`scope` 会被忽略，留着误导人 |

> 当前 App 未勾选 "Expire user authorization tokens"，所以续期路径不会触发。
> 它的意义是让将来开启该选项（或 GitHub 强制开启）时**不必再改代码**。

端到端测试见 `packages/proxy-core/src/oauth.test.ts`（授权 → 回调 → 令牌全流程，
含令牌轮换与各类失败分支）与 `packages/core/src/auth.test.ts`（前端侧的过期判定与会话轮换）。

---

## 4. Markdown 渲染

### 4.1 一个重要发现：不必打包 markdown 解析器

加 `Accept: application/vnd.github.v3.full+json` 后，匿名 REST **能直接取到服务端渲染好的 HTML**：

```
GET /repos/gitalk/gitalk/discussions/442/comments   (anonymous)
Accept: application/vnd.github.v3.full+json
→ body_html ✅  '<p dir="auto">配置贴出来看下？</p>'
   body_text ✅

GET /repos/gitalk/gitalk/issues/1/comments          (anonymous)
Accept: application/vnd.github.v3.full+json
→ body_html ✅  '<p dir="auto">hello Gitalk~</p>'
```

v1 之所以依赖 GraphQL 的 `bodyHTML`，是因为没意识到 REST 加这个 Accept 头同样能拿到 `body_html`。

唯一需要本地渲染的场景是**未提交草稿的预览**（服务端还没有它）。实测
`POST /markdown` **匿名可用并返回正确 HTML**：

```
POST /markdown {"text":"**hi** from `gitalk`"}  → <p><strong>hi</strong> from <code>gitalk</code></p>
```

这是 v1 既有行为，零 bundle 成本。

**结论：不打包 markdown 解析器。** 正文用 `body_html`，预览用 `/markdown`。
若后续发现某条路径取不到 HTML，再引入 `marked` 作局部降级。

### 4.2 遗留 media type

v1 使用的 `application/vnd.github.v3.full+json`、`application/vnd.github.squirrel-girl-preview`
实测仍返回 200（reactions 早已 GA，preview 头已无意义但未被拒绝）。
2.0 统一固定：

```
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2026-03-10
```

并监听 `Deprecation` / `Sunset` 响应头（二者均在 `Access-Control-Expose-Headers` 中）。

---

## 5. 速率限制与缓解

| | 限额（实测） |
|---|---|
| 匿名 REST `core` | **60/hr / IP** |
| 认证 REST | 5,000/hr |
| 认证 GraphQL | **5,000 pts/hr / user token**（按 cost 计） |
| 匿名 GraphQL | **0（不可用）** |
| Search | 10/hr（匿名） |

完整 discussion 查询与 `search(type:DISCUSSION)` 的 GraphQL cost **各为 1**（实测），非常廉价。

### 5.1 ETag 条件请求是有效的免费杠杆（实测）

我的 IP 匿名配额一度耗尽（`core: 0/60`），导致首轮 ETag 测试数据被污染。
改用认证请求复测，结论清晰：

```
初始 200 GET          → remaining 4937（消耗 1）
304 请求 ×3           → remaining 稳定 4937（零消耗 ✅）
```

`GET` 返回 `ETag`（匿名亦然），带 `If-None-Match` 的未变更请求返回 **304 且不计入主限额**。

⚠️ 官方文档仅承诺「correctly authorized with an `Authorization` header」时 304 免费；
匿名条件下的行为我未能干净地验证（配额耗尽）。**实现时应始终把 ETag 缓存作为尽力而为的
优化，而非限额保证。**

另外，60/hr 是按**访客 IP**计算的，NAT／公司代理后的所有访客共享这一额度——
必须像 giscus 那样处理 429 并提示登录：`shouldRevalidate = status => ![403,404,429].includes(status)`。

---

## 6. 技术栈（pnpm monorepo，均为当前 latest）

```
gitalk/
├── packages/
│   ├── core/          # Preact 11 + hooks；框架无关 UI + 数据层
│   ├── react/         # React 包装器（peerDep）
│   ├── vue/           # Vue 3 包装器（peerDep）
│   └── proxy-worker/  # 可选：一键部署的 edge function（方案 B）
└── apps/landing/      # Vite + React + TS + Tailwind v4 落地页
```

| 用途 | 选型 | 版本 |
|---|---|---|
| 核心渲染层 | Preact | **11.0.1** |
| 构建 | Vite（lib mode，多 entry） | 8.3.4 |
| 语言 | TypeScript | 7.0.2 |
| 测试 | Vitest + jsdom | 5.0.5 |
| 落地页 | React + Tailwind v4 | 19.3.1 / 4.3.3 |
| 发版 | **release-please** | 17.11.2 |

### 6.1 Preact 11 维护状态（已核实）

回应"Preact 是否还在维护"的疑问：

- 最新版 **11.0.1** 发布于 2026-10-08
- 仓库最后 push **2026-10-15**，38.9k stars，41 open issues，**未归档**
- 10.29.x 稳定线仍在发补丁（10.29.8 @ 2026-08-01）；8.x 已归入 `legacy` dist-tag

### 6.2 ⚠️ Preact 11 破坏性变更（对本项目的实际影响）

来自官方 upgrade guide：

1. **仅发布 ESM（`.mjs`），UMD/CJS bundle 已移除**
   → v1 那种 `<script>` 挂载 `window.Gitalk` 的 UMD 产物，须由我们自己的 Vite 产线生成 IIFE，
   不能依赖 Preact。
2. **`useRef` 必须传初始值** → v1 的 `useRef()` 写法会类型报错。
3. **数字 style 不再自动补 `px`** → 需显式写单位。
4. **JSX 命名空间收敛** → `JSX.Foo` 改为从 `preact` 直接导入类型。
5. hooks 依赖比较改用 `Object.is` → 更贴近 React，利于迁移。
6. 移除 `render()` 第三个 `replaceNode` 参数；移除 `Component.base`（改用 `this.__v.__e`）。
7. 最低 TypeScript 版本 **5.1**。

### 6.3 三种使用方式

- **无框架**：core 产出 IIFE bundle
  `<script src=".../gitalk.js"></script>` + `new Gitalk({...}).render('#el')`
- **React**：`<Gitalk options={...} />`，内部 mount/unmount core。
  Preact 打包在内，**不存在 React 版本冲突**。
- **Vue**：`defineComponent` 的 `<Gitalk :options="..." />`。

---

## 7. 发版管理：release-please

从 standard-version 迁移到 **release-please 17.11.2**，理由：

- 以 **PR 形式**维护 Release Please Manifest / CHANGELOG，变更过程可评审
- 由 Conventional Commits 自动推导 semver，**无需本地 bump 再 push tag**
- monorepo 场景下可为 `core` / `react` / `vue` **各自独立版本 + 独立 tag**（如 `gitalk-core-v2.0.0`）
- 与 GitHub Actions 原生集成

配套配置：`release-please-config.json` + `.release-please-manifest.json`，
并保留 `chore(release): v{{currentTag}} :rocket:` 的既有提交信息风格。

---

## 8. 分支与部署策略

落地页发布在**裸域名** `https://gitalk.github.io/`。

只有名字形如 `<org>.github.io` 的仓库才能服务裸域名，因此站点必须落在独立仓库
**`gitalk/gitalk.github.io`** 的 `gh-pages` 分支上；放在 `gitalk/gitalk` 自己的
`gh-pages` 里只会得到 `https://gitalk.github.io/gitalk/`。

| 方式 | 说明 | 站点 URL |
|---|---|---|
| S1：`gitalk` 仓库建 `gh-pages` 并启用 Pages | 源码与产物同仓库，无需额外凭据 | `https://gitalk.github.io/gitalk/` |
| **S2（已采用）**：推送到 `gitalk/gitalk.github.io` 的 `gh-pages` 分支 | 需要跨仓库凭据（`GITHUB_TOKEN` 只能写当前仓库） | `https://gitalk.github.io/`（裸域名） |

**最终采用 S2**，因为裸域名要作为 GitHub App 的 Homepage URL：

- `https://gitalk.github.io` 比带 `/gitalk` 子路径的地址更适合填进 App 表单；
- README 里的 Demo 链接本来就指向裸域名，采用 S2 后无需再改；
- 代价是需要一个跨仓库凭据，见 §8.1。

### 8.1 跨仓库凭据：deploy key 而非 PAT

`GITHUB_TOKEN` 的作用域限于当前仓库，无法推送到 `gitalk/gitalk.github.io`。
这里用 **SSH deploy key** 而不是 PAT：

| 方案 | 作用域 | 撤销方式 |
|---|---|---|
| **deploy key（已采用）** | 仅 `gitalk/gitalk.github.io` 一个仓库 | 目标仓库 Settings → Deploy keys 删除 |
| PAT | 账号级，视 scope 可能覆盖全部仓库 | 个人设置里撤销，影响面大 |

在目标仓库添加一个**可写** deploy key，私钥存为 `gitalk/gitalk` 的 secret：

```bash
ssh-keygen -t ed25519 -N '' -f /tmp/k -C 'gitalk-bot gh-pages deploy'
gh api -X POST repos/gitalk/gitalk.github.io/keys \
  -f title='gitalk-bot gh-pages deploy' -f key="$(cat /tmp/k.pub)" -F read_only=false
gh secret set GH_PAGES_DEPLOY_KEY -R gitalk/gitalk < /tmp/k
shred -u /tmp/k
```

`.github/workflows/deploy-pages.yml` 在 push 到 `main` 时构建并发布：

```yaml
- uses: peaceiris/actions-gh-pages@v4
  with:
    deploy_key: ${{ secrets.GH_PAGES_DEPLOY_KEY }}
    external_repository: gitalk/gitalk.github.io
    publish_branch: gh-pages
    publish_dir: ./apps/landing/dist
    force_orphan: true
```

首次部署后还需把目标仓库的 Pages 源指向 `gh-pages`。
**该仓库原本从 `master` 构建，只推送分支不会改变线上站点：**

```bash
gh api -X PUT repos/gitalk/gitalk.github.io/pages \
  -f 'source[branch]=gh-pages' -f 'source[path]=/'
```

`master` 分支保留原 v1 演示页作为存档，不再由 Pages 提供。

> 落地页使用相对 `base: './'`，同一份构建在裸域名和 `/gitalk/` 子路径下都能工作，
> 将来若回退到 S1 无需改代码。

> 另需注意：仓库默认分支已从 `master` 切换为 `main`，
> 否则 release-please 会去 `master` 上找 manifest 而失败（已实测复现）。

> ⚠️ **安全提示（未解决）**：`gitalk/gitalk.github.io` 的 `master` 分支
> `index.html` 中硬编码了
> `clientSecret: 'd1a0b627f9b76d21bd3080d1777d0aa0ad55dd83'`。
> 该文件在公开仓库里，**任何人都能读到**；切到 `gh-pages` 后它仍留在 `master` 上。
> 处置：轮换或直接删除这个旧 OAuth App（`clientID e46f6dec7c07145c652c`）。
> §3 的 Worker 方案让此类泄露在设计上不再可能发生。

---

### 8.2 自部署：三种目标平台

端点要部署到哪里、为什么分成三种目标、各平台的机制与凭据模型差异，见
**[docs/tech-deploy.md](./tech-deploy.md)**。

一句话：`packages/proxy-core/` 承载平台无关的 `handle(request, env, ctx)`，
`proxy-worker`（Cloudflare）、`proxy-cloudbase`（腾讯云 Web 函数）、
`proxy-node`（容器）各是一个薄入口。加一个目标 = 写一个入口文件，不碰逻辑。

## 9. 执行顺序

1. `git checkout -b main`（工作区干净）→ 初始化 pnpm monorepo 骨架
2. `packages/core`：双后端数据层 adapter（先 Issues 后 Discussions）+ Preact UI
3. 实现 `packages/proxy-worker`（三种目标平台）
4. `packages/react`、`packages/vue` 包装器
5. `apps/landing` + Tailwind v4 全新落地页
6. `.github/workflows`：CI + release-please + gh-pages 部署（按 §8 的 S1）
7. Vitest 单测 + README 重写

---

## 10. 未验证清单（实现期须补）

- [ ] PKCE 无 secret 交换是否可行（需跑通真实同意流程）
- [ ] 匿名 304 是否确定免计限额（受配额耗尽影响，仅认证路径已验证）
- [ ] REST discussion comments 的分页顺序语义（线程树的顺序尚未确定）
- [ ] `public_repo` 是否单独足够（仅验证了 `repo`）
- [ ] 搜索索引延迟的具体量级
- [ ] OAuth client_id/client_secret Basic auth 的官方状态（Endpoint 在 OpenAPI 与文档中均存在，
      但因缺少真实 secret 未实跑）

---

## 附：Housekeeping

研究过程中，子代理创建了一个临时测试仓库 `aispin/gitalk-probe-delete-me`。
因 token 缺少 `delete_repo` scope 而无法删除，已将其降级为**私有 + 归档**（只读、不可见），
内容仅一条测试 discussion，无残留风险。
