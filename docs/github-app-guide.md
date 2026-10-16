# GitHub App 创建填写指南

本文对应 `https://github.com/organizations/gitalk/settings/apps/new`（Create GitHub App）表单，
逐字段给出该填什么。表单字段名来自页面 HTML 的 `name` 属性，便于对照。

> 配套文档：[docs/tech.md](./tech.md)（整体技术设计与 API 结论）。

---

## 0. 动手前：三个必须先知道的结论

这三点都是实测/查证得到的，直接决定表单里几个关键字段怎么填。

### 0.1 `gitalk` 这个 slug 已经被占用，新 App 不能叫 `gitalk`

`/apps/gitalk` 在共享命名空间里已存在，且**是一个第三方 GitHub App**：

```
gh api /apps/gitalk
→ {"client_id":"Iv1.4d5a76667e64f1bb","id":5808,"name":"gitalk","owner":"Vincentqyw","slug":"gitalk"}
```

owner 是个人账号 `Vincentqyw`，不是 gitalk org。GitHub App / OAuth App 共用 `/apps/<slug>` 命名空间，
所以新的 App 必须换名字。

已验证可用：

| 候选名字 | 推导 slug | `/apps/<slug>` |
| --- | --- | --- |
| `Gitalk` | `gitalk` | 200 已占用 |
| `Gitalk Comments` | `gitalk-comments` | 200 已占用 |
| `Gitalk App` | `gitalk-app` | 200 已占用 |
| **`Gitalk X`** | **`gitalk-x`** | **404 可用** ✅ |

→ **App name 填 `Gitalk X`。**

> `Gitalk Discussions`（slug `gitalk-discussions`）也曾是候选且同样可用，
> 最终选了 `Gitalk X`。改这个名字只需替换 App name 字段，
> 其余字段（回调、权限、可见性）都不受影响。

### 0.2 回调地址必须填 `/oauth/callback`，但当前代码发的是 proxy 根路径

Worker 的回调路由是 `/oauth/callback`（`packages/proxy-worker/src/index.ts:107`），
我们自己的 `handleAuthorize` 也是这么拼的（同文件 `:133`）：

```ts
target.searchParams.set('redirect_uri', `${url.origin}/oauth/callback`)
```

但前台代码走的是另一条路——`packages/core/src/use-gitalk.ts:202` 调
`auth.loginUrl()`，而 `packages/core/src/auth.ts` 里写的是：

```ts
redirect_uri: this.proxy,   // ← proxy 根路径，缺 /oauth/callback
```

proxy 根路径命中 Worker 的 `case '/'`，返回的是 JSON `{"ok":true,...}`，**不会处理 `code`**。
也就是说：表单填对了，只要不改这行代码，点登录仍然会停在一个 JSON 页面上。

→ **表单按 `.../oauth/callback` 填**；代码侧的修法见 §6.1。

### 0.3 "Expire user authorization tokens" 必须取消勾选

Worker 封存的会话里只有两个字段（`handleCallback`）：

```ts
const session = await sealSession(env, { accessToken: token, issuedAt: Date.now() })
```

全仓库没有任何 `refresh_token` 处理（已 grep 确认）。而勾选过期后 user token 8 小时失效，
且会**返回一个 `refresh_token`**——我们不存它，就续不了期。

→ **取消勾选**。如果 GitHub 后续强制开启，则必须补 refresh 逻辑，见 §6.3。

---

## 1. 逐字段填写

### 1.1 基本信息

| 表单字段 | 填什么 | 说明 |
| --- | --- | --- |
| `integration[name]` | `Gitalk X` | 全局唯一，见 §0.1 |
| `integration[description]` | 见 §1.1.1（中英双语） | 会展示给安装/授权用户 |
| `integration[url]` | `https://gitalk.github.io` | Homepage URL，必填。裸域名根站点，部署方式见 tech.md §8 |

#### 1.1.1 Description 文案（中英双语）

`integration[description]` **只有一个 textarea**（支持 Markdown，上限 20480 字符），
所以下面给三个可直接整段粘贴的版本：中英双语合一（推荐）、纯中文、纯英文。

每段都是**不硬换行的整行文本**——textarea 里的换行会被当成真实换行，粘贴后不必再手动调格式。

**方案 A · 中英双语合一（推荐）**

授权页面向的是全球用户，英文在前、中文在后，两种读者都能读到完整说明：

```
A backend-free comment widget powered by GitHub Discussions. Each comment thread is a Discussion, so there is no database or server to run — drop Gitalk into your blog or docs site and readers can comment and reply with their GitHub account. Available as a framework-free script, a React component, and a Vue component. It only reads and writes Discussions in the repositories you authorize, in order to load and post comments; it accesses no other data.

基于 GitHub Discussions 的无后端评论组件。每条评论线程就是一个 Discussion，无需自建数据库或服务端 —— 把 Gitalk 嵌入博客或文档站点，读者用 GitHub 账号即可评论与回复。支持无框架脚本、React 组件、Vue 组件三种用法。本应用仅在你授权的仓库中读写 Discussions 以加载和发布评论，不访问其他任何数据。
```

**方案 B · 纯中文**

```
基于 GitHub Discussions 的无后端评论组件。每条评论线程就是一个 Discussion，无需自建数据库或服务端 —— 把 Gitalk 嵌入博客或文档站点，读者用 GitHub 账号即可评论与回复。支持无框架脚本、React 组件、Vue 组件三种用法。本应用仅在你授权的仓库中读写 Discussions 以加载和发布评论，不访问其他任何数据。
```

**方案 C · 纯英文**

```
A backend-free comment widget powered by GitHub Discussions. Each comment thread is a Discussion, so there is no database or server to run — drop Gitalk into your blog or docs site and readers can comment and reply with their GitHub account. Available as a framework-free script, a React component, and a Vue component. It only reads and writes Discussions in the repositories you authorize, in order to load and post comments; it accesses no other data.
```

> 三个版本结尾都刻意写了"只读写 Discussions、不访问其他数据"。
> 授权页会紧挨着列出权限清单，文案里主动交代用途能减少访客的授权顾虑。
>
> 同理，上面没有写 "Gitalk 2.0" 这类版本号：App name 字段已经承担了品牌识别，
> 描述里重复版本号反而会在 2.x 之后过期。

### 1.2 Identifying and authorizing users

| 表单字段 | 填什么 | 说明 |
| --- | --- | --- |
| `integration[application_callback_urls_attributes][0][url]` | `https://gitalk-proxy.gitalk.workers.dev/oauth/callback` | Redirect URI，见 §0.2 |
| `integration[application_callback_urls_attributes][0][matching_strategy]` | **留空**（不要勾 Allow wildcard matching） | wildcard 会把 token 发给所有子域/子路径，是安全风险 |
| `integration[user_token_expiration_enabled]` | **取消勾选** | 见 §0.3 |
| `integration[request_oauth_on_install]` | 不勾 | 访客是点"登录"时才授权，不是安装时 |
| `integration[device_flow_enabled]` | 不勾 | Device Flow 已被 CORS 挡住（见 tech.md §3），开了也没用 |

> 自部署 Worker 的人把域名换成自己的即可；同一个 App 最多可加 10 个 Redirect URI。

### 1.3 Post installation

| 表单字段 | 填什么 |
| --- | --- |
| `integration[setup_url]` | 留空 |
| `integration[setup_on_update]` | 不勾 |

### 1.4 Webhook

Gitalk 是拉取模型：进页面时主动拉评论，不依赖任何事件推送，**不需要 Webhook**。

| 表单字段 | 填什么 |
| --- | --- |
| `integration[hook_attributes][active]` | **取消勾选** |
| `integration[hook_attributes][url]` | 留空（取消 Active 后必填校验会解除） |
| `integration[hook_attributes][secret]` | 留空 |
| `integration[hook_attributes][insecure_ssl]` | 保持 `0`（Enable SSL verification） |

> 顺序很重要：先取消 Active，Webhook URL 才会从必填变隐藏；否则表单会被必填校验拦住。

---

## 2. Permissions（权限）

只开两个（外加强制的 Metadata）。

### 2.1 Repository permissions

| 资源 | 设为 | 必要性 |
| --- | --- | --- |
| `integration[default_permissions][discussions]` | **Read and write** | 必需。读评论 + 发评论/回复/表态都靠它 |
| `integration[default_permissions][metadata]` | **Read-only** | 强制项，表单已自动选中，改不了 |
| `integration[default_permissions][issues]` | **Read and write** | 建议开，见下方说明 |
| 其余全部 repository 权限 | **No access** | — |

关于 `issues`：core 保留了 v1 的 issues 后端（`backend: 'issues'`）。
**权限一旦创建后再加，所有已安装仓库都要重新批准一次**，比较烦。
如果你希望 issues 后端也能用上 Worker 的安装令牌（5000/hr），建议现在就一起勾上；
如果确定只要 Discussions，可以留 No access，保持最小授权。

### 2.2 Organization / Account / Enterprise permissions

**全部保持 No access。** 这三段（`data-organization-permissions`、`data-user-permissions`、
`data-business-permissions`）我们一个都不需要：

- 评论读写是仓库级操作，已由 `discussions` 覆盖
- 拿用户身份靠 OAuth 授权流程，不靠 Account permissions

---

## 3. Subscribe to events（事件订阅）

**全部不勾。**

表单顶部三项（`integration[integrator_events][]`：Installation target / Meta / Security advisory）
和下面的 `integration[default_events][]`（Discussion、Discussion comment、Issue comment……）全部留空。

理由同上：拉取模型，不需要推送。

---

## 4. Where can this GitHub App be installed?

| 表单字段 | 选哪个 |
| --- | --- |
| `integration[visibility]` | **Any account**（`public_visibility`） |

默认选中的是 "Only on this account"。**必须改成 Any account**——
否则只有 gitalk org 自己的仓库能装，而 Gitalk 的模型是每个博主把它装到自己的评论仓库上
（giscus 也是 Any account）。

---

## 5. 点 "Create GitHub App" 之后

### 5.1 抄下 / 生成 6 个值

在 App 的 settings 页：

| Worker 环境变量 | 从哪来 |
| --- | --- |
| `GITHUB_APP_ID` | App settings 顶部 "App ID"（纯数字，如 `1236702`） |
| `GITHUB_CLIENT_ID` | "Client ID"，形如 `Iv1.…` / `Iv23li…` |
| `GITHUB_CLIENT_SECRET` | "Client secrets" → Generate a new client secret（只显示一次） |
| `GITHUB_APP_PRIVATE_KEY` | "Private keys" → Generate a private key，下载 `.pem` |
| `SESSION_ENCRYPTION_KEY` | 自己生成：`openssl rand -hex 32` |
| `GITALK_ALLOWED_ORIGINS` | 逗号分隔的允许来源，如 `https://gitalk.github.io`；本地调试可加 `http://127.0.0.1:4181` |
| `GITHUB_INSTALLATION_ID` | 可选。App 只有一个安装时可填，跳过安装发现 |

> 环境变量名以 `packages/proxy-worker/src/index.ts` 的 `Env` 接口为准。

### 5.2 安装 App

App 必须先被安装，Worker 才拿得到 installation token（匿名读依赖它）。

1. App 页面 → Install App → 选 gitalk org
2. Repository access 选包含评论仓库的范围（demo 用 `gitalk/gitalk`）
3. 确认目标仓库 **已开启 Discussions**，且存在用于承载评论的 category

### 5.3 部署 Worker

```bash
cd packages/proxy-worker
npx wrangler secret put GITHUB_APP_ID
npx wrangler secret put GITHUB_APP_PRIVATE_KEY      # 粘贴 .pem 全文
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_ENCRYPTION_KEY
npx wrangler secret put GITALK_ALLOWED_ORIGINS
npx wrangler deploy
```

部署完先自检：`curl https://gitalk-proxy.gitalk.workers.dev/` 应返回
`{"ok":true,"service":"gitalk-proxy"}`。

### 5.4 上传 App logo

⚠️ **Create GitHub App 表单里没有 logo 字段**，创建完成后才能补：

1. 进入 `https://github.com/organizations/gitalk/settings/apps/<slug>`
2. 左侧 **Display information** → **Logo** → Upload
3. 选 `apps/landing/public/logo.png`

该文件为 512×512 方形、满幅不透明（**故意不预烘焙圆角**：GitHub 会用自己的圆角/圆形容器
去裁切，若图片自带圆角，容器内会再套一层圆角，四角透出背景）。
图形四周留白 14%，即使被裁成内接圆，白色气泡也完整可见。

品牌资产都放在 `apps/landing/public/`：

| 文件 | 用途 |
| --- | --- |
| `logo.svg` | 圆角方形 logo 母版（蓝底白标） |
| `favicon.svg` | 站点 favicon，内容同 `logo.svg`（浏览器要求该文件名） |
| `logo-mono.svg` | `currentColor` 单色版，供落地页头部使用 |
| `logo.png` | 512×512 满幅方形，用于上传 GitHub App logo |

品牌色为电光克莱因蓝 `#1e4fff`（浅色背景）／`#6e8cff`（深色背景）。
它同时写在 `apps/landing/src/index.css` 的 `--accent` 和
`packages/core/src/styles/index.css` 的 `--gt-color-main`，改动需两处同步。

### 5.5 本地调试：`.env` 放哪、`.pem` 怎么填

#### `.env` 必须在 `packages/proxy-worker/` 下

`wrangler dev` 读取 `.env` / `.dev.vars`，但它**只在 `wrangler.toml` 所在目录查找，
不会向上级目录搜索**（已实测：把 `.env` 放在仓库根目录不会被加载）。
所以本地密钥文件的位置是：

```
packages/proxy-worker/.env
```

两个文件名都支持，`wrangler dev` 启动时会打印实际加载了哪个：

```
Using secrets defined in .env
```

`.dev.vars` 是 Cloudflare 的约定名；两者都已加入 `.gitignore`。

> 若坚持把 `.env` 放在别处，可用 `wrangler dev --env-file ../../.env` 显式指定。

#### `GITHUB_APP_PRIVATE_KEY`：需要打开 `.pem`，但要压成单行

下载到的 `.pem` 是**多行**的，而 `.env` 的值不能跨行，因此要把换行转成**字面量 `\n`**：

```bash
# 打印成单行（首尾的 BEGIN/END 行保留）
awk 'NF {printf "%s\\n", $0}' ~/Downloads/gitalk-x.*.private-key.pem
```

把输出整行贴进 `.env`，用双引号包住：

```
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----\n"
```

要点：

- **保留 `-----BEGIN/END-----` 行**——Worker 会自己剥掉，缺了 header 也能识别（见下）
- 用**双引号**，避免值里的字符被当作注释
- **PKCS#1 与 PKCS#8 都支持**，不需要跑 `openssl pkcs8` 转换

最后一点值得展开：GitHub 签发的是 **PKCS#1**（`-----BEGIN RSA PRIVATE KEY-----`），
而 WebCrypto 的 `importKey('pkcs8', …)` 只接受 PKCS#8，裸喂会报 `Invalid keyData`。
`packages/proxy-worker/src/pkcs8.ts` 会自动补上 PKCS#8 信封，且格式判定读的是 DER 本身
而非 PEM 头，所以下面几种写法都能用：

| 写法 | 是否可用 |
| --- | --- |
| PKCS#1 多行原文 | ✅ |
| PKCS#1 单行 `\n` 转义 | ✅ |
| PKCS#1 去掉 PEM 头的裸 base64 | ✅ |
| PKCS#8（多行或单行） | ✅ |

#### `SESSION_ENCRYPTION_KEY` 与 SHA-256 无关

这个键必须恰好是 **32 字节、64 个十六进制字符**：

```bash
openssl rand -hex 32
```

它用于 **AES-GCM** 封存会话（`sessionKey()` → `importKey('raw', …, 'AES-GCM')`），
不是哈希。传一个 SHA-256 十六进制串虽然长度也是 64 字符、能跑起来，
但安全性取决于你哈希的那个输入是否真有熵——直接用 `openssl rand` 即可。

> 全仓库只有一处用到 SHA-256：`index.ts` 里 GitHub App JWT 的签名算法
> `RSASSA-PKCS1-v1_5` + `SHA-256`（即 RS256），由 GitHub 规定，不需要你配置。

---

## 6. 填完之后必须改的代码

只填表单登录还是不通。以下是已知缺口，按优先级列出。

### 6.1 🔴 登录回调路径不匹配（阻塞登录）

- **位置**：`packages/core/src/auth.ts`，`loginUrl()` 里的 `redirect_uri: this.proxy`
- **问题**：发出去的是 proxy 根路径，Worker 根路径只返回 JSON，不处理 `code`
- **两种修法**（选一）：
  - **(a) 让前台直接走 Worker 的授权入口**（推荐，最贴合 Worker 现有设计）：
    `window.location.href = `${proxy}/oauth/authorize?return_to=${encodeURIComponent(location.href)}``
    Worker 的 `handleAuthorize` 已负责拼正确的 `redirect_uri` 和 `state`，
    前台不必再自己拼 authorize URL
  - **(b) 保留前台拼 URL，只把 `redirect_uri` 改成 `${this.proxy}/oauth/callback`**，
    并确认 `state` 能带回原页面

### 6.2 🟡 `scope=public_repo` 对 GitHub App 无意义

`auth.ts` 的 `SCOPES = 'public_repo'` 和 Worker `handleAuthorize` 里的 `scope` 都是
**OAuth App 的概念**。GitHub App 的权限由 App 注册信息决定，授权 URL 上的 `scope` 会被忽略。

目前无害，但会误导后续维护者。建议删掉，或加注释说明。

### 6.3 🟡 没有 refresh_token 支持（与 §0.3 是同一件事的两面）

会话只存 `accessToken` + `issuedAt`。若 GitHub 强制开启 token 过期：

1. `exchangeCode` 的返回体里会多出 `refresh_token` / `expires_in`
2. `handleCallback` 需要把 `refreshToken` 一并 `sealSession`
3. 新增一个刷新端点（或在 `/oauth/token` 里按 `expiresAt` 判断后刷新）

### 6.4 🟡 落地页 demo 还指着老的 OAuth App

`apps/landing/src/app.tsx:83` 目前是：

```ts
clientID: 'e46f6dec7c07145c652c',   // 老 OAuth App，且没有配 proxy
```

App 建好后需改成新的 GitHub App client id，并补上 `proxy`，否则 demo 上登录入口是隐藏的
（`canLogin()` 为真但没有可用 proxy）。

---

## 7. 验收清单

创建完成后，按顺序确认：

- [ ] `/apps/gitalk-x` 已可访问（slug 生效）
- [ ] 表单里 Webhook "Active" 是**未勾选**状态
- [ ] Repository permissions 只勾了 Discussions(+Issues) 和强制 Metadata
- [ ] "Any account" 已选中
- [ ] "Expire user authorization tokens" 未勾选
- [ ] Redirect URI 精确等于 `<proxy>/oauth/callback`，且未开 wildcard
- [ ] Private key 已生成、`SESSION_ENCRYPTION_KEY` 已生成
- [ ] App 已安装到评论仓库，且该仓库 Discussions 已开启
- [ ] `curl <proxy>/` 返回 `{"ok":true,...}`
- [ ] §6.1 已修复，点击登录能完整走完并回到原页面
- [ ] 匿名状态能拉到全部评论与回复（对比 v1 的 `gitalk/gitalk#475`，应有 2 条顶层 + 4 条回复）

---

## 附：完整字段速查

```text
integration[name]                                  = Gitalk X
integration[description]                           = <见 §1.1.1，中英双语 / 纯中文 / 纯英文三选一>
integration[url]                                   = https://gitalk.github.io
integration[application_callback_urls_attributes][0][url]
                                                   = https://gitalk-proxy.gitalk.workers.dev/oauth/callback
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
