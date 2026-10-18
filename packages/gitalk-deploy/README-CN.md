# @aifire/gitalk-deploy

把 [Gitalk](https://github.com/gitalk/gitalk) 的 proxy（处理 GitHub 登录与评论写入的那个小服务）
部署到 **Cloudflare Workers** 或 **腾讯云 CloudBase**。

**只读评论不需要它**；它负责的是「让读者能登录、能发评论」。

**English: [README.md](./README.md)**

---

## 不用 npm 也能跑

```bash
npx github:gitalk/deploy -c .env -t cloudflare
```

不需要注册表账号，也不需要先安装。

---

## 第 1 步 — 创建 GitHub App

这一步只能在网页上做，脚本替不了。

1. <https://github.com/settings/apps/new>（组织则在 *Settings → Developer settings → GitHub Apps → New*）
2. **Permissions → Repository permissions**
   - `Discussions: Read and write` —— 读写评论必需的
   - `Metadata: Read-only` —— 自动带上，去不掉
   - 其余全部 **No access**
3. **Callback URL** 填 `https://<你的 proxy 地址>/oauth/callback`
   - 之后可以改，但**只能在那个页面改**：组织所有的 App 用 API 改会返回 404
   - 最多支持 10 个 callback URL，本地和生产地址可以都列上
4. **Webhook**：取消勾选 *Active* —— Gitalk 不用 webhook
5. 创建完成后记下四项：
   - **App ID**（数字）
   - **Client ID**（`Iv1.…` 或 `Iv23li…` 开头）
   - **Client secret** —— 点 *Generate a new client secret*
   - **私钥** —— 点 *Generate a private key*，会下载一个 `.pem`

> ⚠️ App 页面还会显示一个形如 `SHA256:ab12…` 的 **指纹**。**那不是私钥**，
> 只是校验码。CLI 会直接拒绝它，而不是等部署后再报一个看不懂的错。

---

## 第 2 步 — 准备你所用平台的凭据

### 方案 A：Cloudflare Workers

**创建 API Token**：<https://dash.cloudflare.com/profile/api-tokens> →
*Create Token* → *Create Custom Token*：

| 字段 | 值 |
| --- | --- |
| Permissions | `Account` → **Workers Scripts** → **Edit** |
| Account Resources | Include → 你的账号 |
| Zone Resources | 留空（除非要绑自定义域名） |

如果部署时报「无法确定账号」，再补一条 `Account` → **Account Settings** → **Read**，
并把账号 ID 写进环境变量 `CLOUDFLARE_ACCOUNT_ID`（在 *Workers & Pages* 右侧栏能看到）。

```dotenv
CLOUDFLARE_API_TOKEN=…
# CLOUDFLARE_ACCOUNT_ID=…    # 仅当这个 token 能看到多个账号时才需要
```

**自定义域名（可选）** —— 仅当域名**也在 Cloudflare** 上：给同一个 token 加
`Zone` → **Workers Routes** → **Edit**。域名在别的注册商，就要去那边手工加一条
`CNAME`，并把这个地址写进 `GITALK_ALLOWED_ORIGINS`。

### 方案 B：腾讯云 CloudBase

**创建密钥**：<https://console.cloud.tencent.com/cam> → *用户* → *新建用户* → *自定义创建*：

1. 选 **仅编程访问**（不要控制台登录）。**用子账号比用主账号密钥安全**：
   子账号可以单独删除，权限也能收窄。
2. 关联策略 **`QcloudTCBFullAccess`**（CloudBase 全读写）。部署只需要这一条 ——
   它只负责创建和更新云函数，不碰别的东西。
3. 完成后复制 **SecretId** 和 **SecretKey**。

**找环境 ID**：在 CloudBase 控制台里就是地址栏中那串，形如 `my-env-1a2b3c`。

```dotenv
CLOUDBASE_ENV_ID=…
CLOUDBASE_SECRET_ID=…
CLOUDBASE_SECRET_KEY=…
```

> ⚠️ 环境必须支持 **HTTP 访问**（免费试用版没有默认域名）。自定义域名还需要
> **ICP 备案** —— 这两件事 CLI 都做不了。

---

## 第 3 步 — 写 dotenv 文件

```dotenv
# 两个平台都要
GITHUB_APP_ID=…
GITHUB_CLIENT_ID=Iv23li…
GITHUB_CLIENT_SECRET=…
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
…
-----END RSA PRIVATE KEY-----"
SESSION_ENCRYPTION_KEY=…            # openssl rand -hex 32
GITALK_ALLOWED_ORIGINS=https://blog.example,http://127.0.0.1:4181
```

`GITALK_ALLOWED_ORIGINS` 是**允许调用 proxy 的站点**清单：写博客的 origin，
加上你本地开发用的 origin。

再加上第 2 步里对应平台的那几行。

---

## 第 4 步 — 部署

```bash
gitalk-deploy -c .env -t cloudflare      # 或 -t cloudbase
gitalk-deploy -c .env -t cloudflare -n   # 只打印步骤，什么都不执行
```

成功后它会打印地址并自检 `/health`，把那个地址填进配置：

```js
new Gitalk({
  clientID: 'Iv23li…',
  proxy: 'https://gitalk-proxy.<account>.workers.dev'
})
```

---

## 它做了什么

- 联网之前先校验所有变量，缺哪个、该从哪来都会说清楚
- 凭据以 **secret** 形式上传 —— 值走 stdin，**不走命令行参数**（argv 全机器可见）
- 部署打包好的 worker 或云函数，然后请求 `/health` 确认真的可用

## 它刻意不做什么

- **创建 GitHub App** —— 网页表单
- **改 App 的 callback URL** —— 组织所有的 App 拒绝 API 修改
- **添加 Cloudflare 之外的 DNS 记录**
- **备案** —— 那是法律流程，不是技术流程

## 常见问题

| 现象 | 原因 |
| --- | --- |
| `GITHUB_APP_PRIVATE_KEY — the .pem contents, not the fingerprint` | 填了 `SHA256:…` 那串 |
| `wrangler` 说无法确定账号 | token 能看到多个账号 —— 设 `CLOUDFLARE_ACCOUNT_ID` |
| CloudBase 返回 `403` | 子账号没关联 `QcloudTCBFullAccess` |
| 部署成功但 `/health` 不通 | 看云函数日志，通常是少了一个变量 |
| 登录后跳到奇怪的地方 | App 的 callback 必须是 `<proxy>/oauth/callback` |
