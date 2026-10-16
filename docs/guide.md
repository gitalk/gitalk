# Gitalk 使用指南

Gitalk 是一个评论组件：**评论存在你 GitHub 仓库的 Discussions 里**，不需要买服务器、不需要数据库。

这篇文档带你从零把它挂到自己的博客或文档站上。照着做一遍大约 15 分钟（选 C 方案部署到国内的话，域名备案和证书要另外花时间）。

**你需要的**：一个 GitHub 账号、一个用来存评论的仓库、一个能放网页的地方（GitHub Pages、Vercel、自己的服务器都行）。

---

## 总共四步

| 步骤 | 做什么 | 在哪做 | 大概耗时 |
| --- | --- | --- | --- |
| **1** | 创建一个 GitHub App | github.com | 5 分钟 |
| **2** | 把它安装到你的评论仓库 | github.com | 1 分钟 |
| **3** | 部署「令牌服务」 | 你选一个平台 | 5 分钟（选 C 还要额外准备域名和证书） |
| **4** | 把 Gitalk 代码贴进你的网站 | 你的项目 | 3 分钟 |

顺序不要颠倒：第 1 步拿到的 Client ID 要给第 3、第 4 步用，第 3 步拿到的地址要给第 4 步用。

> **「令牌服务」是什么？** GitHub 不允许网页直接完成登录换取令牌，所以必须有一个中间服务帮你做这件事。它是必需的，但第 3 步会给你几种省事的选择。

---

# 第 1 步 · 创建 GitHub App

打开创建页（把 `<你的组织>` 换成你的 GitHub 组织名；个人账号用 `https://github.com/settings/apps/new`）：

```
https://github.com/organizations/<你的组织>/settings/apps/new
```

## 先看这三个坑

这三处填错了，后面怎么弄都登不上，所以先看再动手。

### 坑 1 · 名字不能叫 `gitalk`

GitHub App 的名字会被转成一个网址后缀（叫 slug），而 `gitalk` 这个后缀**早就被一个第三方应用占了**：

| 名字 | 后缀 | 结果 |
| --- | --- | --- |
| `Gitalk` | `gitalk` | ❌ 已被占用 |
| `Gitalk Comments` | `gitalk-comments` | ❌ 已被占用 |
| `Gitalk App` | `gitalk-app` | ❌ 已被占用 |
| **`Gitalk X`** | **`gitalk-x`** | ✅ 可用 |

**填 `Gitalk X` 就行**。想用别的名字也可以，只要 `https://github.com/apps/<后缀>` 打不开（404）就说明能用。

### 坑 2 · 回调地址要带 `/oauth/callback`

「回调地址」（Redirect URI）是登录完成后 GitHub 把用户送回来的地方。它必须精确地以 `/oauth/callback` 结尾。

因为令牌服务的地址由你自己定，所以**这一步你就能先填好**。比如你的令牌服务最终是 `https://gitalk-proxy.你的子域.workers.dev`，就填：

```
https://gitalk-proxy.你的子域.workers.dev/oauth/callback
```

> 拿不准的话也没关系——第 3 步部署完会打印出确切地址，到时候回来补填。
>
> 选 C（腾讯云 CloudBase）的话同理，只是域名换成你自己的，例如 `https://gitalk.你的域名/oauth/callback`——**同样不要带任何路径前缀**。

### 坑 3 · 取消勾选「Expire user authorization tokens」

这个选项的意思是「让用户令牌过期」。Gitalk 目前按**不过期**来设计，所以**不要勾**。

如果以后 GitHub 强制开启，Gitalk 的令牌服务会自动帮你续期，但那是后续的事。

## 要填的字段

正文用大白话说；精确的表单字段名在[附录](#附录--字段速查)，需要时再对。

| 这一项 | 填什么 |
| --- | --- |
| 名称 | `Gitalk X`（见坑 1） |
| 描述 | 从下面复制一段 |
| Homepage URL | `https://gitalk.github.io` |
| 回调地址 | `<你的令牌服务地址>/oauth/callback`（见坑 2） |
| 回调的 Allow wildcard matching | **不勾**。勾了会把令牌发给所有子域，有安全风险 |
| Expire user authorization tokens | **取消勾选**（见坑 3） |
| Request user authorization during installation | 不勾。访客是点「登录」时才授权 |
| Enable Device Flow | 不勾。浏览器用不了这个流程，开了也没用 |
| Setup URL / On update | 留空 / 不勾 |
| Webhook Active | **取消勾选**。Gitalk 是主动去拉评论，不需要 GitHub 推送 |
| Repository permissions | `Discussions` 选 **Read and write**；`Metadata` 选 **Read-only**（这项是强制的） |
| 其余所有权限 | **No access** |
| Subscribe to events | **全部不勾** |
| Where can this app be installed | **Any account** ← 默认是 "Only on this account"，必须改 |

<details>
<summary>为什么必须选 Any account？</summary>

因为 Gitalk 的用法是「每个博主把它装到自己的仓库上」。选 "Only on this account" 就只有 gitalk 组织自己的仓库能装。

</details>

<details>
<summary>要不要顺便开 issues 权限？</summary>

Gitalk 支持把评论存在 Issues 里（给 1.x 老用户用）。**权限一旦创建后再加，所有已安装的仓库都要重新批准一次**，比较麻烦。如果你打算用 Issues，现在就一起勾上；确定只用 Discussions 就保持 No access。

</details>

## 描述文案（可直接整段复制）

描述框只有一个，中英文都能写。以下是**整段文本**，粘贴即可。

**中英双语（推荐）**

```
A backend-free comment widget powered by GitHub Discussions. Each comment thread is a Discussion, so there is no database or server to run — drop Gitalk into your blog or docs site and readers can comment and reply with their GitHub account. Available as a framework-free script, a React component, and a Vue component. It only reads and writes Discussions in the repositories you authorize, in order to load and post comments; it accesses no other data.

基于 GitHub Discussions 的无后端评论组件。每条评论线程就是一个 Discussion，无需自建数据库或服务端 —— 把 Gitalk 嵌入博客或文档站点，读者用 GitHub 账号即可评论与回复。支持无框架脚本、React 组件、Vue 组件三种用法。本应用仅在你授权的仓库中读写 Discussions 以加载和发布评论，不访问其他任何数据。
```

**纯中文**

```
基于 GitHub Discussions 的无后端评论组件。每条评论线程就是一个 Discussion，无需自建数据库或服务端 —— 把 Gitalk 嵌入博客或文档站点，读者用 GitHub 账号即可评论与回复。支持无框架脚本、React 组件、Vue 组件三种用法。本应用仅在你授权的仓库中读写 Discussions 以加载和发布评论，不访问其他任何数据。
```

**纯英文**

```
A backend-free comment widget powered by GitHub Discussions. Each comment thread is a Discussion, so there is no database or server to run — drop Gitalk into your blog or docs site and readers can comment and reply with their GitHub account. Available as a framework-free script, a React component, and a Vue component. It only reads and writes Discussions in the repositories you authorize, in order to load and post comments; it accesses no other data.
```

> 三段结尾都写了「只读写 Discussions、不访问其他数据」——授权页会紧挨着列出权限清单，主动说明用途能减少访客的顾虑。

## 创建完之后，做两件事

### 一、记下这几个值

在 App 的设置页：

| 值 | 在哪 |
| --- | --- |
| App ID | 页面顶部的纯数字 |
| Client ID | 形如 `Iv23li…` |
| Client secret | 「Client secrets」→ Generate（**只显示一次**，记得存好） |
| Private key | 「Private keys」→ Generate，会下载一个 `.pem` 文件 |
| `SESSION_ENCRYPTION_KEY` | 自己生成，见第 3 步 |

> ⚠️ **别把「密钥指纹」当成密钥。** Private keys 那一列显示的 `SHA256:…` 是**指纹**，不是密钥。你要的是下载下来的那个 `.pem` 文件。第 3 步的脚本会替你识破这个错误。

### 二、上传 logo

⚠️ **创建表单里没有 logo 字段**，得创建完再补：

App 设置页 → 左侧 **Display information** → **Logo**。

用 [`apps/landing/public/logo.png`](../apps/landing/public/logo.png)（512×512 方形）。

---

# 第 2 步 · 安装 App

⚠️ **不安装，评论就加载不出来。** 这一步只能用浏览器手动完成。

打开安装页：

```
https://github.com/apps/<你的后缀>/installations/new
```

例如 <https://github.com/apps/gitalk-x/installations/new>

1. 选要装到哪个账号或组织
2. Repository access 选中存放评论的仓库
3. 确认那个仓库**已经开启 Discussions**（仓库 Settings → Features → Discussions）
4. 在里面建一个分类（category），默认用 `General` 就行

装好后想核对一下：打开 GitHub 的 Applications 设置页（个人账号是 <https://github.com/settings/installations>；装在组织上就在该组织的 Settings → GitHub Apps 里看）。能看到这个 App、并且列出的正是你存评论的那个仓库，就说明装上了。

---

# 第 3 步 · 部署「令牌服务」

## 先选一条路

| 方案 | 适合谁 | 花费 | 难度 |
| --- | --- | --- | --- |
| **A · 用官方提供的** | 只想先试试、本地开发 | 免费 | 不用做任何事 |
| **B · Cloudflare Workers** | 读者主要在海外 | 免费额度足够 | 一条命令 |
| **C · 腾讯云 CloudBase** | 读者主要在中国大陆 | 有免费体验版 | 一条命令 + 一个已备案的域名 + 一张自己准备的证书 |
| **D · 容器** | 有自己的服务器 / 懂 Docker | 取决于你的服务器 | 一条命令 + Docker |

> **为什么不能直接用官方的？** 官方那个是给大家**体验和测试**用的，没有可用性承诺，访问量大时会限速。正式站点请选 B / C / D 之一。
>
> **中国大陆的读者要注意**：Cloudflare 的 `*.workers.dev` 域名在中国大陆**访问不了**，所以如果你选 B，请务必绑一个自己的域名（见下）。

## 准备工作（B / C / D 都一样）

```bash
cp packages/proxy-worker/.env.example packages/proxy-worker/.env
# 然后用编辑器打开 packages/proxy-worker/.env 填值
```

`.env` 里要填的内容：

| 键 | 值从哪来 |
| --- | --- |
| `GITHUB_APP_ID` | 第 1 步记下的 |
| `GITHUB_CLIENT_ID` | 第 1 步记下的 |
| `GITHUB_CLIENT_SECRET` | 第 1 步记下的 |
| `SESSION_ENCRYPTION_KEY` | 执行 `openssl rand -hex 32` 生成 |
| `GITALK_ALLOWED_ORIGINS` | 你的网站地址，如 `https://your.blog`（多个用逗号分隔） |
| `GITHUB_APP_PRIVATE_KEY` | **留空**——见下 |
| `CLOUDFLARE_API_TOKEN` | 只在选 B 时需要 |
| `CLOUDBASE_ENV_ID` | 只在选 C 时需要：CloudBase 环境 ID |
| `CLOUDBASE_SECRET_ID` / `CLOUDBASE_SECRET_KEY` | 只在选 C 时需要：腾讯云子账号密钥 |
| `PUBLIC_ORIGIN` | 只在选 C 时需要：令牌服务的正式地址，如 `https://gitalk.你的域名`（要带 `https://`，末尾别加斜杠） |

> 选 C 的话，示例文件里没有 `CLOUDBASE_*` 和 `PUBLIC_ORIGIN` 这几行，自己在 `.env` 末尾补上就行。

### 私钥怎么处理？最简单：别管它

**把下载的 `.pem` 文件直接放进 `packages/proxy-worker/` 目录**，脚本会自己找到并使用。`GITHUB_APP_PRIVATE_KEY` 那一行留空即可。

> `.env` 和 `.pem` 都已经被 `.gitignore` 排除，**不会被提交**。部署脚本每次还会再确认一遍。

## A · 用官方的

什么都不用做，第 4 步直接跳过 `proxy` 这一项即可。

## B · 部署到 Cloudflare

1. 打开 <https://dash.cloudflare.com/profile/api-tokens> → **Create Token** → 选 **Edit Cloudflare Workers** 模板 → 创建 → 复制
2. 把复制的值填进 `.env` 的 `CLOUDFLARE_API_TOKEN`
3. 执行：

```bash
pnpm --filter @gitalk/proxy-worker deploy
```

脚本会自动：校验配置 → 上传 → 设置密钥 → 健康检查 → 打印最终地址。

> ⚠️ **给中国大陆的读者用的话，请绑一个自己的域名**（Cloudflare 后台 → 你的 Worker → Settings → Domains & Routes → Add → Custom domain）。`*.workers.dev` 这个域名在中国大陆打不开，绑了自定义域名才能访问。

## C · 部署到腾讯云 CloudBase

读者主要在中国大陆时选这条。它比 Cloudflare 多两件事：**一个已经 ICP 备案的域名**，和**一张自己准备的证书**。部署那一条命令照旧，域名和证书都在 CloudBase 控制台里点。

### 1. 先把服务部署上去

1. 在[腾讯云访问管理](https://console.cloud.tencent.com/cam)创建一个**子账号**，关联两个策略：`QcloudAccessForTCBRole`（部署用）和 `QcloudSSLFullAccess`（后面上传证书用）。⚠️ 不要用主账号密钥
2. 在 [CloudBase 控制台](https://console.cloud.tencent.com/tcb)创建一个环境，记下环境 ID
3. 把子账号的 `SecretId` / `SecretKey`、环境 ID、`PUBLIC_ORIGIN` 填进 `.env`
4. 执行：

```bash
pnpm --filter @gitalk/proxy-cloudbase deploy
```

做完会得到一个 `*.tcloudbase.com` 的默认地址。**它只能用来测试**（限速、功能不全），正式对外必须绑自己的域名。

### 2. 绑一个自己的域名

前提：域名**已经完成 ICP 备案**。没有备案域名的话，这一步怎么弄都不会成功，可以先跳过，等备案下来再做。

1. **域名归属校验**：第一次添加域名时，CloudBase 会要求你先去 DNS 加一条 TXT 记录（主机记录是 `_cloudbase-challenge.你的子域`，值填环境 ID）。加完回到控制台再点一次。
2. **准备证书**：CloudBase 体验版**不支持托管证书**，得自己出一张。可行做法是用 Let's Encrypt 申请（域名 DNS 在阿里云时，走阿里云 DNS-01 验证最省事），然后在控制台把证书传上去，得到一个证书 ID。
3. **绑定域名**：在 CloudBase 控制台把域名和刚拿到的证书绑上。首次是「添加域名」，以后只是换证书就用「更新证书」，不要重复添加。
4. 绑定成功后，控制台会给出一个 CNAME 值，拿去你的 DNS 服务商加一条 CNAME 解析。

### 3. 让域名指向函数（触发路径）

域名绑好还不够，还要告诉 CloudBase「这个域名来的请求交给谁」：

- 在控制台给这条域名加一条**触发路径**（有的界面叫「路由」）：路径填 `/`，指向 `gitalk-proxy` 这个函数。
- ⚠️ **「路径透传」要关掉（选「不透传」）。** 开着的话，函数收到的地址会多带一段前缀，它认不出来，只会返回 404。

做完之后，浏览器打开 `https://你的域名`，能看到 `{"ok":true,"service":"gitalk-proxy"}` 就说明通了。比如现在跑通的那个就是 `https://gitalk.xsin.work`。

> ⚠️ **第 4 步填 `proxy` 时只写到域名，不要带路径。** 例如 `https://你的域名` ✅、`https://你的域名/gitalk` ❌（会 404）。回调地址同理，是 `https://你的域名/oauth/callback`。

## D · 用容器部署

```bash
# 构建（产出零依赖的单文件）
pnpm --filter @gitalk/proxy-node build

# 打镜像
docker build -t gitalk-proxy packages/proxy-node

# 运行（会把 .env 里的配置传进去）
docker run -d --name gitalk-proxy -p 8787:8787 \
  --env-file packages/proxy-worker/.env \
  gitalk-proxy
```

如果你把私钥放在 `.pem` 文件里（而不是填进 `.env`），额外挂载一下：

```bash
docker run -d --name gitalk-proxy -p 8787:8787 \
  --env-file packages/proxy-worker/.env \
  -e GITHUB_APP_PRIVATE_KEY_FILE=/key.pem \
  -v "$PWD/packages/proxy-worker/你的密钥.pem:/key.pem:ro" \
  gitalk-proxy
```

部署到自己的服务器时，记得在前面加一层 HTTPS 反向代理（如 Nginx / Caddy）——登录跳转必须是 HTTPS。

---

# 第 4 步 · 接入你的网站

## 安装

```sh
pnpm add @aifire/gitalk          # 无框架
pnpm add @aifire/gitalk-react    # React
pnpm add @aifire/gitalk-vue      # Vue
```

或者直接引 CDN：

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@aifire/gitalk@latest/dist/gitalk.css">
<script src="https://cdn.jsdelivr.net/npm/@aifire/gitalk@latest/dist/gitalk.js"></script>
```

## 三种写法

**无框架**

```html
<div id="gitalk-container"></div>
<script>
  const gitalk = new Gitalk({
    clientID: 'Iv23li…',        // 第 1 步的 Client ID
    owner: '你的用户名',         // 存放评论的仓库
    repo: 'blog-comments',
    admin: ['你的用户名'],       // 谁可以创建讨论，见「关于 admin」
    number: 42,                 // 这一页对应的讨论编号
    proxy: 'https://…'          // 第 3 步拿到的地址，只写到域名；用官方的就删掉这行
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
        clientID: 'Iv23li…',
        owner: '你的用户名',
        repo: 'blog-comments',
        admin: ['你的用户名'],
        number: 42,
        proxy: 'https://…'   // 只写到域名，不要带路径
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
  clientID: 'Iv23li…',
  owner: '你的用户名',
  repo: 'blog-comments',
  admin: ['你的用户名'],
  number: 42,
  proxy: 'https://…'   // 只写到域名，不要带路径
}
</script>

<template>
  <Gitalk :options="options" />
</template>
```

## 配置项

| 配置 | 默认 | 说明 |
| --- | --- | --- |
| `clientID` | — | 你的 GitHub App Client ID |
| `owner` / `repo` | — | 存放评论的仓库 |
| `admin` | `[]` | 可以创建讨论的用户名单，见下 |
| `number` | — | 讨论编号。**推荐填**，省一次查找 |
| `id` | 当前网址路径 | 没填 `number` 时用来自动匹配页面的标识 |
| `backend` | `'discussions'` | 1.x 老用户改成 `'issues'` 可继续用 Issues |
| `category` | — | 创建讨论时用的分类 |
| `perPage` | `10` | 每页显示多少条（回复也算在内） |
| `pageSize` | — | 和 `perPage` 是同一个东西的两种写法；两个都写时以 `pageSize` 为准 |
| `proxy` | 官方地址 | 你的令牌服务地址。**只写到域名，不要带路径** |
| `language` | 浏览器语言 | 支持 11 种语言 |

### 关于 `admin`：为什么页面写着「请联系 @xxx 初始化创建」

`admin` 填的是 GitHub 用户名，决定**谁能把这一页的讨论建出来**。

- 页面上**没有对应的讨论时，它不会自动创建**。这是故意的——否则访客一进页面，就会在你的仓库里建出一堆讨论。
- 普通访客（包括已经用 GitHub 登录的普通读者）看到的是「**请联系 @你的用户名 初始化创建**」。这不是报错，是在等你把这条讨论建出来。
- 只有写进 `admin`、并且已经登录的人，才会多看到一个「初始化 Issue」按钮。
- 点它会**当场建出这条讨论**，建完就能直接评论（需要你已登录、且 App 有 Discussions 写权限）。

### 关于 `number`：怎么知道讨论编号

打开你的评论仓库 → Discussions → 点进那条讨论，看网址最后的数字，例如：

```
https://github.com/你的用户名/blog-comments/discussions/42
                                                      ↑ 这就是 number
```

`number` 是**推荐填**的：填了它，组件直接打开对应的那条讨论，不用再去猜，加载也更快。

**第一次还没有讨论怎么办？** 这条讨论不会自己出现，需要你建一次（见上一节）。建好之后有两种用法：

- **推荐**：把它的编号填进 `number`，完事。
- 或者干脆不填 `number`，但要保证**讨论标题和 `id` 长得一模一样**（`id` 没填时，默认就是这一页的网址路径）。组件会去讨论列表里按标题把它找出来。

### 评论数是怎么算的

- GitHub 讨论列表里显示的数字 = **顶层评论 + 所有回复**。
- 组件顶部的计数用的是同一个口径，**回复也算在内**；它显示的是**当前已经加载出来的条数**，点「加载更多」之后数字会变大。
- 回复是**嵌在父评论下面**显示的，不和顶层评论平铺在一起。
- 「每页 10 条」数的也是这个总数：一条顶层评论带 3 条回复，一页里就占掉 4 个名额。

---

# 检查是否成功

- [ ] GitHub App 创建好了，`https://github.com/apps/<后缀>` 能打开
- [ ] App 已安装到评论仓库，且该仓库开启了 Discussions
- [ ] 回调地址是 `<令牌服务地址>/oauth/callback`
- [ ] 令牌服务部署成功，访问它的地址能看到 `{"ok":true,"service":"gitalk-proxy"}`
- [ ] （选 C 时）自己的域名能打开，并且加过触发路径、「路径透传」是关的
- [ ] `proxy` 填的是纯域名，后面没有跟任何路径
- [ ] 打开你的网页，能看到评论区
- [ ] 点「登录」能走完 GitHub 授权并回到原页面
- [ ] 登录后能发评论

---

# 常见问题

## 评论区显示「未找到相关的 … 进行评论」

这**不是报错**，意思是这一页还没有对应的讨论。普通访客看到的就是「请联系 @xxx 初始化创建」，只有 `admin` 里的人登录后才会多出「初始化 Issue」按钮。照上面「关于 `admin`」那一节把讨论建出来就正常了。

## 评论区一直转圈、不显示内容

多半是 App 没安装，或者评论仓库没开 Discussions。回到[第 2 步](#第-2-步--安装-app)检查。

## 报错提到 `503` 或「No usable GitHub credential」

令牌服务没拿到凭据。常见原因有两个：

- **App 没安装**——回到第 2 步
- **私钥填错了**——最容易犯的是把 GitHub 显示的 `SHA256:…` **指纹**当成密钥填了进去。正确做法是把下载的 `.pem` 文件放进 `packages/proxy-worker/` 目录

## 点登录后卡在一个 JSON 页面

回调地址没填对。到 App 设置页确认「Identifying and authorizing users」里的回调地址，**必须精确等于** `<令牌服务地址>/oauth/callback`。

## 登录成功但回到页面还是未登录

同样是回调地址的问题——检查它和令牌服务的实际地址是否完全一致（多一个斜杠、少了 `https` 都不行）。

## 浏览器控制台报 CORS 错误

`.env` 里的 `GITALK_ALLOWED_ORIGINS` 必须包含你网站的来源。注意**只写协议+域名+端口，不要带路径**：

```
GITALK_ALLOWED_ORIGINS=https://your.blog,http://127.0.0.1:4181
```

改完记得重新部署令牌服务。

## 评论只显示了一部分

默认每页 10 条（回复也算在 10 条里面），点「加载更多」看剩下的。如果你填了 `number`，确认编号对得上。

## 中国大陆的读者打不开评论区

如果你用的是 Cloudflare 且地址以 `workers.dev` 结尾——**这个域名在中国大陆是访问不了的**。绑一个自己的域名即可；或者改用上面的 C 方案（腾讯云 CloudBase）。

---

# 附录 · 字段速查

表单里字段的实际名称，方便对照：

```text
integration[name]                                  = Gitalk X
integration[description]                           = <见描述文案>
integration[url]                                   = https://gitalk.github.io
integration[application_callback_urls_attributes][0][url]
                                                   = <令牌服务地址>/oauth/callback
integration[application_callback_urls_attributes][0][matching_strategy]
                                                   = <留空>
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
integration[default_permissions][issues]           = write   （可选；只要 Discussions 就设 none）
integration[default_permissions][metadata]         = read    （强制）
其余 default_permissions[*]                        = none
integration[integrator_events][]                   = <全不勾>
integration[default_events][]                      = <全不勾>
integration[visibility]                            = public_visibility   （Any account）
```

---

> 想了解 Gitalk 内部是怎么工作的（登录流程、令牌续期、各平台的部署架构），见面向开发者的 [技术方案](tech.md)。
