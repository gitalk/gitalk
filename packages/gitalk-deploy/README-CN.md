# @aifire/gitalk-deploy

把 [Gitalk](https://github.com/gitalk/gitalk) 的 proxy（处理 GitHub 登录与评论写入的那个小服务）
部署到 **Cloudflare Workers** 或 **腾讯云 CloudBase**。

**只读评论不需要它。** 部署它是为了「让读者能登录、能发评论」，同时把匿名读从
GitHub 的每 IP 60 次/小时提到 5000 次/小时。

> **这份文件是接入步骤的唯一真源。**
>
> 其他文档 —— 根目录 README、`docs/guide.md`、落地页 —— 只做一句话概述并链接到这里。
> 两份文档说法不一致时，以这份为准。
>
> **English: [README.md](./README.md)** —— 中英两份是同一份文档，逐条对应。

---

## 五步

| # | 步骤 | 在哪做 |
| --- | --- | --- |
| 1 | 准备仓库：**public**、开启 Discussions、建一个分类 | GitHub |
| 2 | 创建 GitHub App | GitHub |
| 3 | 写 `.env`、部署，然后补 callback URL | 你的机器 + GitHub |
| 4 | **把 App 安装到你的仓库** | GitHub |
| 5 | 引入组件 | 你的网站 |

第 4 步就是大家会漏的那一步：**创建 App 不等于安装 App**。少了安装，proxy 就没法为你的仓库换 token。

### 本文一直使用的例子

下面所有命令和配置都填好了一组具体值。你照着换成自己的即可，形状不变。

| | 示例值 | 从哪来 |
| --- | --- | --- |
| App 名 | **My Niubi Gitalk** | 第 2 步你在表单里填的名字 |
| App 的 slug | `my-niubi-gitalk` | GitHub 自动生成：空格变连字符、字母转小写 |
| 仓库 | `octocat/demo-repo` | 存放评论的仓库 |
| 站点来源 | `https://octocat.github.io` | 嵌入组件的博客或文档站 |
| 代理地址 | `https://my-niubi-gitalk.octocat.workers.dev` | 第 3 步部署后打印出来 |
| Callback URL | `https://my-niubi-gitalk.octocat.workers.dev/oauth/callback` | 代理地址 + `/oauth/callback` |

`octocat` 代表你自己的账号或组织，`demo-repo` 代表你自己的仓库。`123456` 与
`Iv1.xxxxxxxxxxxx` 是**示例值**：用你 App 页面上显示的那两个，不要照抄。

---

## 不用 npm 也能跑

```bash
npx github:gitalk/deploy -c .env -t cloudflare
```

`npx` 直接从 GitHub 取包：不需要注册表账号，也不需要先安装。

---

## 第 1 步 — 准备仓库

例子里的仓库是 `octocat/demo-repo`。两件事，都在它的 **Settings** 里：

1. **仓库必须是 public。** 代理的匿名读只服务公开仓库 —— 可见性检查失败即拒绝，
   私有仓库会拿到 `403`，没有仓库权限的读者退回到 REST 读也一样读不到。
2. **开启 Discussions：** *Settings → General → Features → Discussions*。然后打开
   **Discussions** 标签，至少建一个分类（默认的 `General` 就行）。新建的 thread 会落到
   GitHub 返回的第一个分类，除非你用 `category` 指定。

---

## 第 2 步 — 创建 GitHub App

本文创建一个叫 **My Niubi Gitalk** 的 App。这一步只能在网页上做，脚本替不了。

1. 打开 <https://github.com/settings/apps/new> —— 组织则在
   *Settings → Developer settings → GitHub Apps → New*。
2. **Permissions → Repository permissions**
   - `Discussions: Read and write` —— 读写评论必需的
   - `Metadata: Read-only` —— 自动带上，去不掉
   - 其余全部 **No access**
3. **Callback URL：先留空。** 它要写成 `https://<代理地址>/oauth/callback`，而代理要到
   第 3 步才部署出来。第 3 步会回来填这一栏。现在就猜一个地址，正是
   `redirect_uri_mismatch` 的来源。
4. **Webhook**：取消勾选 *Active* —— Gitalk 不用 webhook。
5. 记住：之后想改这个地址，**只能**在 App 设置页改 —— 组织所有的 App 用 API 改会返回 404。

**slug 是怎么来的。** GitHub 会把 App 名转成一个网址后缀：空格变连字符、字母转小写。
所以 `My Niubi Gitalk` 就是 `my-niubi-gitalk` —— 它既是 App 公开网址
`https://github.com/apps/my-niubi-gitalk` 的最后一段，也是第 4 步安装页要用的那个值。
如果这个 slug 已经被占用，GitHub 会拒绝这个名字；换一个名字，slug 跟着变
（`gitalk`、`gitalk-app`、`gitalk-comments` 都已经被占了，见
[`docs/guide.md`](../../docs/guide.md)）。

把这个页面上的四个值记下来：

| 值 | `My Niubi Gitalk` 的例子 | 用在哪 |
| --- | --- | --- |
| **App ID** | `123456` | `GITHUB_APP_ID` |
| **Client ID** | `Iv1.xxxxxxxxxxxx`（真实的形如 `Iv23li…` 或 `Iv1.…`） | `GITHUB_CLIENT_ID`，以及组件的 `clientID` |
| **Client secret** | 点 *Generate a new client secret* 生成 | `GITHUB_CLIENT_SECRET` |
| **私钥** | `my-niubi-gitalk.private-key.pem` | `GITHUB_APP_PRIVATE_KEY`，填整个文件 |

> ⚠️ App 页面还会显示一个形如 `SHA256:ab12…` 的**指纹**。那只是校验码，**不是私钥**。
> CLI 会直接拒绝它，而不是等部署后再报一个看不懂的错。

---

## 第 3 步 — 写 `.env`、部署，然后补 callback URL

### 3a. `.env` 里有什么

下面每一项都是必需的。CLI 会在联网之前校验，缺哪个、该从哪来都会说清楚。

| 变量 | 值从哪来 |
| --- | --- |
| `GITHUB_APP_ID` | App 页面（第 2 步） |
| `GITHUB_CLIENT_ID` | App 页面（第 2 步） |
| `GITHUB_CLIENT_SECRET` | 点 *Generate a new client secret*（第 2 步） |
| `GITHUB_APP_PRIVATE_KEY` | `.pem` 的全文 —— **不是** `SHA256:` 指纹 |
| `SESSION_ENCRYPTION_KEY` | `openssl rand -hex 32`（32 字节随机数的十六进制） |
| `GITALK_ALLOWED_ORIGINS` | 允许调用 proxy 的**站点来源**，逗号分隔 |

**`GITALK_ALLOWED_ORIGINS` 填的是站点，不是仓库。** 例子里是
`https://octocat.github.io`，再加上你本地开发用的 origin。写裸 origin：不带路径、末尾不要斜杠。
它也决定 OAuth 回调能把访客送回哪里 —— 不在这个列表里的站点能登录，但会被送回代理。

然后补上你要部署到的那个平台的凭据。

**Cloudflare Workers** —— 在
<https://dash.cloudflare.com/profile/api-tokens> → *Create Token* → *Create Custom Token*
创建 API Token：

| 字段 | 值 |
| --- | --- |
| Permissions | `Account` → **Workers Scripts** → **Edit** |
| Account Resources | Include → 你的账号 |
| Zone Resources | 留空（除非要绑自定义域名） |

```dotenv
CLOUDFLARE_API_TOKEN=…
# CLOUDFLARE_ACCOUNT_ID=…    # 仅当这个 token 能看到多个账号时才需要
```

部署时报「无法确定账号」，就再补一条 `Account` → **Account Settings** → **Read**，
并设 `CLOUDFLARE_ACCOUNT_ID`（在 *Workers & Pages* 右侧栏能看到）。

**腾讯云 CloudBase** —— 在 <https://console.cloud.tencent.com/cam> → *用户* → *新建用户* →
*自定义创建* 创建密钥：

1. 选 **仅编程访问**（不要控制台登录）。**用子账号比用主账号密钥安全**：
   子账号可以单独删除，权限也能收窄。
2. 关联策略 **`QcloudTCBFullAccess`** —— 部署只需要这一条。
3. 复制 **SecretId** 和 **SecretKey**，以及 CloudBase 控制台里的环境 ID
   （地址栏中那串，形如 `my-env-1a2b3c`）。

```dotenv
CLOUDBASE_ENV_ID=…
CLOUDBASE_SECRET_ID=…
CLOUDBASE_SECRET_KEY=…
```

> ⚠️ 环境必须支持 **HTTP 访问**（免费试用版没有默认域名）。自定义域名还需要
> **ICP 备案** —— 这两件事 CLI 都做不了。

完整的一份，按例子填好：

```dotenv
# 两个平台都要
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxx
GITHUB_CLIENT_SECRET=…
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
…
-----END RSA PRIVATE KEY-----"
SESSION_ENCRYPTION_KEY=…            # openssl rand -hex 32
GITALK_ALLOWED_ORIGINS=https://octocat.github.io,http://127.0.0.1:5173

# 只在 Cloudflare 时
CLOUDFLARE_API_TOKEN=…

# 只在 CloudBase 时
CLOUDBASE_ENV_ID=…
CLOUDBASE_SECRET_ID=…
CLOUDBASE_SECRET_KEY=…
```

上面的 App ID 和 Client ID 是例子的 —— 换成你 App 页面上的值。私钥因为有引号，
换行会保留下来；`.env` 和 `.pem` 都在 `.gitignore` 里，**绝不能提交**。

**自定义域名（可选）** —— 域名在 Cloudflare 上时可以直接绑；给同一个 token 加
`Zone` → **Workers Routes** → **Edit**。域名在别的注册商，就要去那边手工加一条 `CNAME`，
并把这个地址写进 `GITALK_ALLOWED_ORIGINS`。

### 3b. 部署

```bash
npx github:gitalk/deploy -c .env -t cloudflare
npx github:gitalk/deploy -c .env -t cloudbase
npx github:gitalk/deploy -c .env -t cloudflare -n   # 只打印计划，什么都不执行
```

成功后它会打印代理地址，并问部署好的服务要一次健康检查（`/`，返回
`{"ok":true,"service":"gitalk-proxy"}`）。如果 worker 在 `octocat` 账号下叫
`my-niubi-gitalk`，这个地址就是 `https://my-niubi-gitalk.octocat.workers.dev`。
**把它记下来** —— 3c 要用，组件的 `proxy` 也要用。

### 3c. 补 callback URL —— 必须等部署之后

> **等地址出来。** callback URL 是 `https://<3b 打印的地址>/oauth/callback`。
> 部署之前代理还不存在，这时候填什么都是错的。

回到 App 设置页，把 **Callback URL** 填成
`https://my-niubi-gitalk.octocat.workers.dev/oauth/callback`。不要带路径前缀，末尾也不要斜杠。

> ⚠️ 漏了这一步的表现是：读者点「登录」时被 GitHub 拒绝，提示
> `redirect_uri_mismatch`。填好立刻生效，不用重新部署。

---

## 第 4 步 — 把 App 安装到你的仓库

> **只创建 App 是不够的。**
>
> 打开 <https://github.com/apps/my-niubi-gitalk/installations/new>，选 `octocat`，
> Repository access 选 **Only select repositories**，勾上 `demo-repo`，然后点 **Install**。

换一个 App 或仓库时，URL 永远是
`https://github.com/apps/<slug>/installations/new` —— slug 就是第 2 步拿到的那个。

为什么必须安装：

- 代理用 App 的私钥签一个 JWT，查安装记录（`GET /app/installations`），再换成
  **installation token**（`POST /app/installations/{id}/access_tokens`）。
- installation token 只能读 **App 已安装的仓库**。刚创建、没安装的 App 没有安装记录，
  GitHub 不会签发 token。
- 拿不到 token 时，代理对匿名读返回 `503`，日志里是
  `no installation found for this app`；组件退回到 GitHub REST 的每 IP 60 次/小时，
  并在控制台打 `gitalk: proxy read failed`。页面访问量一上来，看起来就是评论加载不出来；
  私有仓库则完全读不到。

核对：打开 <https://github.com/settings/installations>（装在组织上则在组织的
*Settings → GitHub Apps*），能看到这个 App，且仓库列表里有 `demo-repo`，就说明装上了。

安装和部署是两件独立的事：第 3 步之前或之后装都可以。把它放在这里，是因为到这一步
你才真正决定了「哪个仓库要用 Gitalk」。

---

## 第 5 步 — 引入组件

```js
const gitalk = new Gitalk({
  clientID: 'Iv1.xxxxxxxxxxxx', // 示例值 —— 换成你 App 的 Client ID
  owner: 'octocat',             // 拥有该仓库的用户名或组织
  repo: 'demo-repo',            // 只写仓库名 —— 千万别写 `octocat/demo-repo`
  admin: ['octocat'],           // 谁可以为这一页创建 thread
  number: 42,                   // 这一页对应的 Discussion 编号
  proxy: 'https://my-niubi-gitalk.octocat.workers.dev' // 3b 的地址，只写到域名
})

gitalk.render('gitalk-container')
```

- **`repo` 只写仓库名。** 写成 `octocat/demo-repo` 会让 GitHub 去找
  `octocat/octocat/demo-repo`，每个请求都 404。
- **`proxy` 只写到 origin**，不带路径，末尾不要斜杠。
- **`number` 推荐填。** 不填时组件拿 Discussion 标题去匹配 `id`（默认是
  `location.pathname`），而且第一次需要管理员手动把 thread 建出来。
- **`backend`** 默认 `discussions`；要沿用 1.x 的 Issues，传 `'issues'`。
- **`clientSecret` 不写进页面。** 2.0 里它只存在你刚部署的 proxy 里。
- 样式、暗色模式与 11 种语言都由组件自带。

---

## 多仓库 / 多站点

一个 proxy 可以服务多个仓库、多个站点 —— 比如 `octocat/demo-repo` 再加一个仓库。
但三个条件都要满足：

1. **App 装在每一个仓库上。** 用同一个安装（一个账号或组织、勾上所有需要的仓库）：
   代理只查它找到的第一个安装。
2. **每个站点的 origin 都在 `GITALK_ALLOWED_ORIGINS` 里。** 加站点要改这个值并重新部署；
   加仓库不用。
3. **5000 次/小时是 installation token 的额度**，这个 proxy 后面的所有站点共享。
   已登录的读者用的是自己的额度。

仓库公开/私有的结论会缓存五分钟，所以一个刚转成私有的仓库，最多还能被匿名读五分钟。

---

## 能直接用 Gitalk 官方部署的 proxy 吗？

不能。本项目托管的那个 proxy（`https://gitalk-proxy.aispin-abf.workers.dev`）的
**`GITALK_ALLOWED_ORIGINS` 只包含本项目自己的站点**。其他域名的请求会拿到另一个
origin 的 CORS 头，浏览器在请求到达 GitHub 之前就把它拦掉了 —— 登录和匿名读的加速
都用不了。

想让某个站点用上它，只能由运维手工把那个域名加进白名单，这不是读这份 README 的人
自己能做的操作。请自己部署一份：一条命令，约五分钟，免费额度就够。

---

## 它做了什么

- 联网之前先校验所有变量，缺哪个、该从哪来都会说清楚
- 凭据以 **secret** 形式上传 —— 值走 stdin，**不走命令行参数**（argv 全机器可见）
- 部署打包好的 worker 或云函数，然后问部署好的服务是否健康

## 它刻意不做什么

- **创建 GitHub App**、**安装 App** —— 都是网页表单
- **改 App 的 callback URL** —— 组织所有的 App 拒绝 API 修改
- **添加 Cloudflare 之外的 DNS 记录**
- **备案** —— 那是法律流程，不是技术流程

## 常见问题

| 现象 | 原因 |
| --- | --- |
| 代理日志里 `no installation found for this app`，评论退回 60 次/小时 | App 建了但没安装 —— 做第 4 步 |
| 匿名读返回 `403` | 仓库是私有的，或者 App 没装到它上面 |
| `GITHUB_APP_PRIVATE_KEY — the .pem contents, not the fingerprint` | 填了 `SHA256:…` 那串 |
| `wrangler` 说无法确定账号 | token 能看到多个账号 —— 设 `CLOUDFLARE_ACCOUNT_ID` |
| CloudBase 返回 `403` | 子账号没关联 `QcloudTCBFullAccess` |
| 部署完健康检查不通 | 看云函数日志，通常是少了一个变量 |
| 登录时报 `redirect_uri_mismatch` | App 的 callback 必须是 `<proxy>/oauth/callback`，且要在 3b 之后填 |
| 登录后回到代理而不是文章页 | 文章页的 origin 不在 `GITALK_ALLOWED_ORIGINS` 里 |
| `Discussions are disabled for octocat/demo-repo` | 打开 Discussions（第 1 步）并建一个分类 |
