# Gitalk 2.0 自部署指南

跑起来需要两样东西：**一个 GitHub App** 和 **一个 Cloudflare Worker**。
前者负责权限与登录，后者负责把 GitHub 密钥挡在浏览器之外。

全程约 15 分钟，两个账号都免费。

> 配套：[docs/tech.md](./tech.md) 讲整体设计与 API 结论。本文只讲「怎么做」。

---

## 总览

| 步骤 | 做什么 | 在哪做 |
| --- | --- | --- |
| **1** | 创建 GitHub App | github.com |
| **2** | 安装它 | github.com |
| **3** | 部署 Worker | 本地命令行 |
| **4** | 把地址接回去 | 改 1 处代码 + 1 处 App 设置 |
| **✓** | 验收：匿名能拉到全部评论与回复 | — |

**顺序不能颠倒**：第 1 步拿到的 client id 要给第 3 步用，第 3 步产出的地址要给第 4 步用。

---

# 第 1 步 · 创建 GitHub App

打开创建页（把 `<org>` 换成你的组织，个人账号用 `https://github.com/settings/apps/new`）：

```
https://github.com/organizations/gitalk/settings/apps/new
```

## 先看这三个坑，再动手填

这三条是实测/查证得到的，踩中任何一个都会让后面的步骤白做。

### 坑 1 · `gitalk` 这个名字已被第三方占用

GitHub App 和 OAuth App **共用 `/apps/<slug>` 命名空间**，而 `/apps/gitalk` 早就被占了：

```
gh api /apps/gitalk
→ {"id":5808,"name":"gitalk","owner":"Vincentqyw","slug":"gitalk"}
```

owner 是个人账号，不是 gitalk org。所以必须换名。已验证：

| App name | slug | `/apps/<slug>` |
| --- | --- | --- |
| `Gitalk` | `gitalk` | ❌ 已占用 |
| `Gitalk Comments` | `gitalk-comments` | ❌ 已占用 |
| `Gitalk App` | `gitalk-app` | ❌ 已占用 |
| **`Gitalk X`** | **`gitalk-x`** | ✅ 可用 |

→ **名称填 `Gitalk X`**。换别的名字也可以，只要 `/apps/<slug>` 是 404。

### 坑 2 · 回调地址必须带 `/oauth/callback`

Worker 只在 `/oauth/callback` 上处理授权码。根路径 `/` 是个健康检查，只返回 JSON。

→ 填 `<你的 Worker 地址>/oauth/callback`，例如
`https://gitalk-proxy.aispin-abf.workers.dev/oauth/callback`

> 前台**不自己拼** GitHub 的授权 URL：它跳转到 `<proxy>/oauth/authorize`，由 Worker 负责
> 拼 `redirect_uri` 和 `state`。这样回调地址只有 Worker 一个来源，前后端不可能对不上。
> 你能提前知道 Worker 地址（名字由你定），所以**第 1 步就能把这个字段填对**，不必等第 3 步。

### 坑 3 · 取消勾选 "Expire user authorization tokens"

Worker 封存的会话里只有 `accessToken` 和 `issuedAt`，**全仓库没有 `refresh_token` 处理**。
一旦勾选过期，token 8 小时后失效且会下发 `refresh_token`——我们不存它，就续不了期。

→ **取消勾选**。

## 要填的字段

正文用人类语言；括号里是表单的真实字段名，完整清单见[附录 A](#附录-a--完整字段速查)。

| 字段 | 填什么 |
| --- | --- |
| 名称 | `Gitalk X`（见坑 1） |
| 描述 | 复制下方任一版本 |
| Homepage URL | `https://gitalk.github.io` |
| 回调地址（Redirect URI） | `<Worker 地址>/oauth/callback`（见坑 2） |
| 回调的 Allow wildcard matching | **留空不勾**——开了会把 token 发给所有子域/子路径 |
| Expire user authorization tokens | **取消勾选**（见坑 3） |
| Request user authorization (OAuth) during installation | 不勾。访客是点「登录」时才授权 |
| Enable Device Flow | 不勾。Device Flow 已被 CORS 挡住，开了没用 |
| Setup URL / On update | 留空 / 不勾 |
| Webhook · Active | **取消勾选**。Gitalk 是拉取模型，不需要推送 |
| Repository permissions | `Discussions` **Read and write**、`Metadata` **Read-only**（强制） |
| 其余所有权限 | **No access** |
| Subscribe to events | **全不勾** |
| Where can this app be installed | **Any account** ← 默认是 "Only on this account"，必须改 |

> **`issues` 权限要不要一起开？** core 保留了 v1 的 issues 后端。
> 权限**创建后再加，所有已安装仓库都要重新批准一次**，比较烦。所以：如果你可能用
> issues 后端，现在就一起勾上；确定只要 Discussions 就留 No access，保持最小授权。
>
> **为什么必须选 Any account？** Gitalk 的模型是每个博主把 App 装到自己的评论仓库上。
> 选 "Only on this account" 就只有 gitalk org 自己的仓库能装（giscus 也是 Any account）。

> **Webhook 的填写顺序**：先取消 `Active`，URL 才会从必填变隐藏；否则表单会被必填校验拦住。

## 描述文案（可直接整段粘贴）

只有一个 textarea（支持 Markdown）。以下都是**不硬换行的整行文本**，粘贴后不用再调格式。

**中英双语（推荐）** —— 授权页面向全球用户，英文在前中文在后，两种读者都能读到：

```
A backend-free comment widget powered by GitHub Discussions. Each comment thread is a Discussion, so there is no database or server to run — drop Gitalk into your blog or docs site and readers can comment and reply with their GitHub account. Available as a framework-free script, a React component, and a Vue component. It only reads and writes Discussions in the repositories you authorize, in order to load and post comments; it accesses no other data.

基于 GitHub Discussions 的无后端评论组件。每条评论线程就是一个 Discussion，无需自建数据库或服务端 —— 把 Gitalk 嵌入博客或文档站点，读者用 GitHub 账号即可评论与回复。支持无框架脚本、React 组件、Vue 组件三种用法。本应用仅在你授权的仓库中读写 Discussions 以加载和发布评论，不访问其他任何数据。
```

**纯中文**：

```
基于 GitHub Discussions 的无后端评论组件。每条评论线程就是一个 Discussion，无需自建数据库或服务端 —— 把 Gitalk 嵌入博客或文档站点，读者用 GitHub 账号即可评论与回复。支持无框架脚本、React 组件、Vue 组件三种用法。本应用仅在你授权的仓库中读写 Discussions 以加载和发布评论，不访问其他任何数据。
```

**纯英文**：

```
A backend-free comment widget powered by GitHub Discussions. Each comment thread is a Discussion, so there is no database or server to run — drop Gitalk into your blog or docs site and readers can comment and reply with their GitHub account. Available as a framework-free script, a React component, and a Vue component. It only reads and writes Discussions in the repositories you authorize, in order to load and post comments; it accesses no other data.
```

> 三个版本结尾都刻意交代了「只读写 Discussions、不访问其他数据」——授权页会紧挨着列出权限
> 清单，主动说明用途能减少访客的授权顾虑。
>
> 也刻意**没写版本号**：「2.0」这类字眼会在 2.x 之后过期，品牌识别交给 App name。

## 创建后还要做两件事

### 一、拿 6 个值

在 App 的 settings 页：

| 值 | 从哪来 |
| --- | --- |
| App ID | 页面顶部，纯数字 |
| Client ID | `Iv1.…` 或 `Iv23li…` |
| Client secret | Client secrets → Generate（**只显示一次**） |
| Private key | Private keys → Generate，下载 `.pem` |
| `SESSION_ENCRYPTION_KEY` | 自己生成：`openssl rand -hex 32` |
| `GITALK_ALLOWED_ORIGINS` | 逗号分隔，如 `https://gitalk.github.io` |

这些值先记下，第 3 步要用。

> ⚠️ **别把「密钥指纹」当成密钥。** Private keys 列表里那一列 `SHA256:…` 是**指纹**，
> 不是密钥本身。要的是下载下来的 `.pem` 文件。部署脚本会识破这个错误并直接告诉你。

### 二、传 logo

⚠️ **Create 表单里没有 logo 字段**，创建后才能补：
App settings → 左侧 **Display information** → **Logo**。

用 `apps/landing/public/logo.png`（512×512 方形、满幅不透明）。
**故意不预烘焙圆角**：GitHub 会用自己的圆角/圆形容器裁切，图片自带圆角会在容器里再套一层。

---

# 第 2 步 · 安装 App

⚠️ **不安装就没有 installation token，匿名读会直接返回
`503 {"error":"No usable GitHub credential"}`。** 这是最后一道只能由人在浏览器里完成的步骤。

```
https://github.com/apps/<slug>/installations/new
```

例如 <https://github.com/apps/gitalk-x/installations/new>

1. 选要装到哪个账号/组织
2. Repository access 选包含评论仓库的范围
3. 确认目标仓库**已开启 Discussions**，且存在承载评论的 category

装没装成功，可以这样查（需要 App JWT，见附录 B）：

```bash
curl -s -H "Authorization: Bearer $APP_JWT" \
  -H 'Accept: application/vnd.github+json' -H 'User-Agent: gitalk' \
  https://api.github.com/app/installations | python3 -m json.tool | head -20
```

返回 `[]` 就是还没装上。

---

# 第 3 步 · 部署 Worker

## ① 建一个 Cloudflare API Token

打开 <https://dash.cloudflare.com/profile/api-tokens> → **Create Token** →
选 **Edit Cloudflare Workers** 模板 → Continue → Create → 复制。

写进 `packages/proxy-worker/.env`：

```bash
cp packages/proxy-worker/.env.example packages/proxy-worker/.env
# 编辑 .env，填入 CLOUDFLARE_API_TOKEN 和上面那 6 个值
```

`.env` 已被 `.gitignore` 覆盖（`.env`、`.env.*`、`.dev.vars`、`*.pem` 全在内），不要提交。
部署脚本每次运行也会替你确认这一点。

有了 token 就**不需要 `wrangler login`**——脚本用它完成认证、上传与 secret 设置。

> **私钥最省事的放法**：把下载的 `.pem` 直接丢进 `packages/proxy-worker/` 就行。
> 脚本会发现它、自己读取，并确认它被 git 忽略。该目录下只能有一个 `.pem`。
> 不想放文件也可以压成单行写进 `.env`，两种等价——见[附录 B](#附录-b--本地调试)。

## ② 一条命令部署

```bash
pnpm --filter @gitalk/proxy-worker deploy
```

脚本依次完成：

| 步骤 | 做什么 |
| --- | --- |
| 1 | 读 `.env`，确认它确实被 git 忽略 |
| 2 | 校验字段格式——**包括识破「把密钥指纹当密钥填」** |
| 3 | 自动解析 Cloudflare 账号；多账号时才需填 `CLOUDFLARE_ACCOUNT_ID` |
| 4 | 上传 Worker |
| 5 | 把 6 个值作为**加密 secret** 推送（先部署再推：`secret put` 要求脚本已存在） |
| 6 | 健康检查 `https://<worker>.<子域>.workers.dev/` |
| 7 | 比对 `DEFAULT_PROXY`，不一致就打印需同步的两处 |

---

# 第 4 步 · 把地址接回去

## ① 改代码里的默认端点

`packages/core/src/auth.ts`：

```ts
export const DEFAULT_PROXY = 'https://<worker>.<子域>.workers.dev'
```

## ② 改 GitHub App 的回调地址

App settings → **Identifying and authorizing users** → Redirect URI，
确认等于 `<DEFAULT_PROXY>/oauth/callback`。

> **组织拥有的 App 无法用 REST API 修改**（`PATCH /app` 返回 404），只能在网页上改。
> 个人账号拥有的 App 才能走 API。

**这两处必须一致。** 只改一处，登录会停在 GitHub 的 OAuth 错误页——症状和「地址不匹配」
完全联想不到一起，所以脚本第 7 步专门帮你比对。

## 关于 Worker 地址

worker 名固定为 `gitalk-proxy`（`wrangler.toml`），地址是
`https://gitalk-proxy.<子域>.workers.dev`。**子域是账号级资源，可能在你建 Worker 之前就已存在**：

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/subdomain" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['subdomain'])"
```

`PUT` 同一端点会返回 `409 / 10036`——**子域不能用 API 改名**，只能到控制台
**Workers & Pages → Your subdomain → Change**（账号级，影响该账号下全部 Worker）。

若账号还没有子域，`wrangler deploy` 会给出注册链接；官方文档说的是
Workers & Pages 页 → **Your subdomain** 旁的 **Change**，但从未注册过时该控件不会出现，
此时用 `https://dash.cloudflare.com/<account id>/workers/onboarding`。

**建议正式发布时绑自定义域名**（`routes`）而非依赖 `*.workers.dev`：子域与账号绑定，
迁移账号或子域被回收会让所有已发布的 widget 集体失效。Cloudflare 官方也建议生产
Worker 走自定义域名或 route（workers.dev 被视为 Free website，面向个人/业余项目）。

---

# 验收

- [ ] `/apps/<slug>` 可访问（slug 生效）
- [ ] Webhook `Active` 未勾选
- [ ] 权限只勾了 `Discussions`(+`issues`) 和强制 `Metadata`
- [ ] **Any account** 已选中
- [ ] **Expire user authorization tokens** 未勾选
- [ ] Redirect URI 精确等于 `<proxy>/oauth/callback`，且未开 wildcard
- [ ] Private key 已下载、`SESSION_ENCRYPTION_KEY` 已生成
- [ ] App 已安装到评论仓库，且该仓库 Discussions 已开启
- [ ] `curl <proxy>/` 返回 `{"ok":true,...}`
- [ ] **匿名状态能拉到全部评论与回复**
      —— 对比 v1 基准 `gitalk/gitalk#475`，应有 **2 条顶层 + 4 条回复**
- [ ] 点击登录能走完 OAuth 并回到原页面，且地址栏里没有残留 `gitalk_session`

最后一条是真正的端到端验证，可以这样跑：

```bash
curl -s -X POST <proxy>/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ repository(owner: \"gitalk\", name: \"gitalk\") { discussion(number: 475) { title comments(first: 20) { totalCount } } } }"}'
```

---

# 排错

## `503 {"error":"No usable GitHub credential"}`

Worker 拿不到 installation token。按可能性排序：

| 原因 | 怎么确认 | 怎么修 |
| --- | --- | --- |
| **App 没有安装** | `GET /app/installations` 返回 `[]` | 回到[第 2 步](#第-2-步--安装-app) |
| **私钥填成了指纹** | `.env` 里是 `SHA256:…` 开头 | 用 `.pem` 文件，见[附录 B](#附录-b--本地调试) |
| **私钥不是该 App 的** | 本地用同一把密钥签 JWT 调 `GET /app`，看是 401 还是 200 | 重新生成并下载 |

排查时先开日志，比盲猜快得多：

```bash
cd packages/proxy-worker
npx wrangler tail --format pretty
```

> **历史坑（已修复）**：早期版本的所有 GitHub 请求都没设 `User-Agent`，而 GitHub 对这类请求
> 返回的是 **403 而非 401**，日志只写 `no installation found for this app`，极易误判成
> 「没装 App」。实测同一 JWT：带 `User-Agent` → `201`，不带 → `403
> Request forbidden by administrative rules`。Workers 运行时不会自带 `User-Agent`，
> 而从 Node/curl 调用会自带，所以本地怎么试都正常——这个差异极具迷惑性。

## 登录后回到页面上，但仍是未登录状态

三条链路都要通，逐个查：

1. **Redirect URI 与 Worker 地址不一致** → GitHub 会停在授权错误页，或者授权码发到了
   不处理 `code` 的地方。确认 App 设置里的 Redirect URI 精确等于 `<proxy>/oauth/callback`
   （组织拥有的 App 只能在网页上改，`PATCH /app` 会返回 404）。
2. **回调地址没在 App 里注册** → `redirect_uri` 校验失败。
3. **`/oauth/token` 返回 401** → 会话已失效或密钥不对。看 Worker 日志：
   `npx wrangler tail --format pretty`。

正常情况下回调会带 `?gitalk_session=…` 回到原页面，前端把它换成 token 后**立即从地址栏抹掉**
（避免留在历史记录/分享链接里）。若地址栏还留着这个参数，说明前端没跑到那一步。

## `Session expired; sign in again`（401）

Worker 判定会话里的访问令牌已过期、且**无法续期**。两种成因：

- App 勾选了 "Expire user authorization tokens"，但会话里没有 `refresh_token`
  （可能是设置变更前登录的）→ 让访客重新登录一次即可
- `refresh_token` 本身也过期了（GitHub 给 6 个月）→ 同上，重新登录

只要 App 开启了过期且登录时会下发 `refresh_token`，Worker 就会**自动续期**，访客无感。
续期时 GitHub 会轮换 `refresh_token`，Worker 随新会话一起下发，前端自动替换。

## 浏览器报 CORS 错误

`GITALK_ALLOWED_ORIGINS` 必须包含站点的来源（scheme + host + port，**不要带路径**）：

```
GITALK_ALLOWED_ORIGINS=https://your.site,http://127.0.0.1:4181
```

## 评论只拉到一部分

分页没走完。检查页面选项里的 `perPage` 与 `page`；v1 的 `gitalk/gitalk#475`
（2 条顶层 + 4 条回复）是现成的比对基准。

---

# 附录 A · 完整字段速查

正文用人类语言，这里是表单里 `name` 属性的原始值，便于对照源码：

```text
integration[name]                                  = Gitalk X
integration[description]                           = <见描述文案，三选一>
integration[url]                                   = https://gitalk.github.io
integration[application_callback_urls_attributes][0][url]
                                                   = <proxy>/oauth/callback
integration[application_callback_urls_attributes][0][matching_strategy]
                                                   = <留空，strict>
integration[user_token_expiration_enabled]         = 取消勾选
integration[request_oauth_on_install]              = 不勾
integration[device_flow_enabled]                   = 不勾
integration[setup_url]                             = <留空>
integration[setup_on_update]                       = 不勾
integration[hook_attributes][active]               = 取消勾选
integration[hook_attributes][url]                  = <留空>
integration[hook_attributes][secret]               = <留空>
integration[hook_attributes][insecure_ssl]         = 0
integration[default_permissions][discussions]      = write
integration[default_permissions][issues]           = write   （建议；只要 Discussions 可设 none）
integration[default_permissions][metadata]         = read    （强制）
其余 default_permissions[*]                        = none
integration[integrator_events][]                   = <全不勾>
integration[default_events][]                      = <全不勾>
integration[visibility]                            = public_visibility   （Any account）
```

---

# 附录 B · 本地调试

## `.env` 必须在 `packages/proxy-worker/` 下

`wrangler dev` 读取 `.env` / `.dev.vars`，但**只在 `wrangler.toml` 所在目录查找，
不会向上级目录搜索**——放仓库根目录不会被加载。启动时会打印实际加载了哪个：

```
Using secrets defined in .env
```

`.dev.vars` 是 Cloudflare 的约定名，两个都支持，都已 gitignore。

## 私钥：直接放 `.pem`，或压成单行

**方式一（推荐）**：把 `.pem` 丢进 `packages/proxy-worker/`。脚本自己读取并校验 gitignore 状态。

**方式二**：压成单行写进 `.env`（`.env` 的值不能跨行，所以要把换行转成**字面量 `\n`**）：

```bash
awk 'NF {printf "%s\\n", $0}' ~/Downloads/<app>.private-key.pem
```

输出整行贴进 `.env`，用双引号包住：

```
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
```

要点：

- **保留 `-----BEGIN/END-----` 行**——Worker 会自己剥掉，缺了 header 也能识别
- 用**双引号**，避免值里的字符被当作注释
- **PKCS#1 与 PKCS#8 都支持**，不需要跑 `openssl pkcs8` 转换

最后一点值得展开：GitHub 签发的是 **PKCS#1**（`BEGIN RSA PRIVATE KEY`），而 WebCrypto 的
`importKey('pkcs8', …)` 只接受 PKCS#8，裸喂会报 `Invalid keyData`。
`packages/proxy-worker/src/pkcs8.ts` 会自动补上 PKCS#8 信封，且格式判定读的是 DER 本身
而非 PEM 头，所以下面几种写法都能用：

| 写法 | 可用 |
| --- | --- |
| PKCS#1 多行原文 | ✅ |
| PKCS#1 单行 `\n` 转义 | ✅ |
| PKCS#1 去掉 PEM 头的裸 base64 | ✅ |
| PKCS#8（多行或单行） | ✅ |

## `SESSION_ENCRYPTION_KEY` 与 SHA-256 无关

必须恰好 **32 字节、64 个十六进制字符**：

```bash
openssl rand -hex 32
```

它用于 **AES-GCM** 封存会话，不是哈希。传一个 SHA-256 十六进制串长度也够、能跑起来，
但安全性取决于你哈希的输入是否真有熵——直接用 `openssl rand` 即可。

> 全仓库只有一处 SHA-256：`index.ts` 里 App JWT 的签名算法
> `RSASSA-PKCS1-v1_5` + `SHA-256`（即 RS256），由 GitHub 规定，不需要配置。

## 本地起签名验证用的 App JWT

排查凭据问题时很有用：

```bash
# 用 .pem 签一个 9 分钟有效的 JWT（RS256）
# 载荷：{ iat: now-30, exp: now+540, iss: <App ID> }
# 然后带上它调用：
curl -s -H "Authorization: Bearer $APP_JWT" \
  -H 'Accept: application/vnd.github+json' -H 'User-Agent: gitalk' \
  https://api.github.com/app        # 200 = 私钥与 App ID 匹配
```

---

# 附录 C · 登录流程内部实现

这一节解释登录是怎么走通的，改动相关代码前值得先读一遍。

## 三个组件，各管一段

```
浏览器                  Worker                      GitHub
  │                       │                           │
  ├─ 跳转 /oauth/authorize ─►                          │
  │                       ├─ 302，拼 redirect_uri ────►│  授权页
  │                       │     和 state（不含 scope） │
  │◄────────── 回到 /oauth/callback?code=…&state=… ────┤
  │                       ├─ 用 code + client_secret ─►│
  │                       │◄──── access_token ─────────┤
  │                       │      (+ refresh_token)     │
  │◄─ 302 回原页面，带 ?gitalk_session=<密文> ──────────┤
  ├─ 前端取出 session、POST /oauth/token ─►            │
  │                       ├─ 解封会话；过期则续期 ────►│
  │◄──── { access_token, session? } ───────────────────┤
  ├─ 存 token；把 gitalk_session 从地址栏抹掉           │
```

**为什么前台不自己拼 GitHub 的授权 URL**：`redirect_uri` 必须与 App 注册值完全一致，
`state` 必须能带回原页面。这两件事只有 Worker 同时知道（它知道自己的公开 origin，
也持有 secret）。放在前台就会有两份实现，一旦漂移就是「填对了也登不上」这类难查的故障。

**为什么 session 而不是 token 会被持久化**：token 会过期，session 才是能换出新 token 的东西。
前端把 session 存进 localStorage，token 过期时静默续期，访客无感。

**为什么 session 一落地就从地址栏删掉**：URL 会进入历史记录、被复制分享、通过 Referer 外泄。
session 没有服务端密钥解不开，但也没有理由留着它。

## 令牌过期与自动续期

| 情况 | 行为 |
| --- | --- |
| App 未开启 "Expire user authorization tokens" | 无 `expires_in`，令牌永不过期，会话一直可用 |
| 已开启，令牌仍有效 | 直接返回，不打扰 GitHub |
| 已开启，令牌过期 | 用 `refresh_token` 静默续期，**返回新会话** |
| 续期成功但 GitHub 未返回新 `refresh_token` | 沿用旧的（它仍然有效），避免丢掉续期能力 |
| `refresh_token` 也过期（GitHub 给 6 个月） | 返回 `401 Session expired; sign in again`，前端退回未登录态 |

前端侧对应的行为：

- `getToken()` 对**已过期**的令牌返回 `null`，而不是把死令牌发出去换来一堆 401。
  宁可回退到匿名读（仍有 5000/hr），也好过整页报错。
- 页面加载时若「有会话但令牌已过期」，在发起任何请求前先静默续期。
- 续期失败若是因为**网络**（而非 401），保留会话——一次网络抖动不该让人重新登录。

> 目前 App 的 "Expire user authorization tokens" 是**未勾选**状态，所以续期路径不会触发。
> 它是为了让将来开启该选项（或 GitHub 强制开启）时无需再改代码。

## 相关测试

- `packages/core/src/auth.test.ts` —— 过期判定、会话存储与轮换、失败处理
- `packages/proxy-worker/src/oauth.test.ts` —— 用打桩的 GitHub 跑通
  authorize → callback → token 全流程，含过期续期与各种失败分支

## 没有 `scope` 参数是故意的

GitHub App 的权限由 App 注册信息决定，授权 URL 上的 `scope` 会被**忽略**。
`scope=public_repo` 是 OAuth App 时代的概念，留着只会误导后来人，所以前台和 Worker 都不再发它。
