# 交接文档（Handoff）

> 用途：上下文压缩或换会话后，凭这份文档就能接着干活，不必重新摸索。
> 最后更新：Gitalk 2.0 多平台自部署推进中。
> **先读「一句话现状」和「下一步」，再读其余部分。**

---

## 一句话现状

端点逻辑已拆成平台无关的 `proxy-core`，**Cloudflare 与容器两条路已跑通并验证**，
**CloudBase 函数已部署但还没有公网入口**——只差一张 `gitalk.xsin.work` 的证书。

---

## 下一步（按顺序）

1. **为 `gitalk.xsin.work` 签发证书**（阿里云 DNS-01）
   - 凭据已在 `.env`：`ALIYUN_SECRET_ID_DNS` / `ALIYUN_SECRET_KEY_DNS`
   - 参考项目：`/Volumes/Pluto/dev/github/aispin/x.certbot`（见下方评估）
   - ⚠️ 本机 **Docker 已安装但 daemon 未运行**
2. **上传证书到腾讯云 SSL** → 拿到 `certId`
   - 子账号 `ai-matrix-dev` 已加 `QcloudSSLFullAccess` ✓
3. **绑定域名**：`tcb domains add gitalk.xsin.work -e <envId> --certid <certId>`
4. **加触发路径**：`/gitalk` → `WEB_SCF:gitalk-proxy`
   - ⚠️ 必须实测 `enablePathTransmission` 取值：我们的 handler 按**根路径**路由
     （`/oauth/authorize`、`/graphql`），前缀若被透传进去会 404
5. **端到端验证**：健康检查 / 授权跳转参数 / 匿名读，与 CF、容器三方比对
6. **落地页加端点切换**（CF ↔ CloudBase），设计已定，见下
7. **文档**：把 `tech.md` §8.2 自部署方案拆到 `tech-deploy.md`，`tech.md` 里引用
8. **npm 2.2.1 未发布**（见「未了事项」）

---

## 已完成并验证

### 包结构

```
packages/proxy-core/       平台无关：handle(request, env, ctx) → Response
packages/proxy-worker/     CF Workers 入口（4 行 default export）
packages/proxy-node/       Node http ↔ Web Request 适配 + Dockerfile
packages/proxy-cloudbase/  CloudBase Web 函数（复用 proxy-node 的构建产物）
```

`proxy-core` 只用 `Request` / `Response` / `crypto.subtle` / `fetch`，Node 20 全部原
生提供——所以端点逻辑**一份都没有重复**：CloudBase 的函数代码就是
`packages/proxy-node/dist/server.js`。

### 三端状态

| 目标 | 部署 | 验证 |
| --- | --- | --- |
| **CF Workers** | ✅ `https://gitalk-proxy.aispin-abf.workers.dev` | ✅ 授权参数、匿名读（2 顶层 + 1 回复）、错误回跳 302 |
| **容器** | — | ✅ 本地实测，与 CF **逐项一致**（健康检查/授权跳转/匿名读） |
| **CloudBase** | ✅ `Type=HTTP / Status=Active` | ⚠️ 无公网入口（缺证书） |

容器产物：**16KB 零依赖单文件**，Dockerfile 只需 `COPY dist/server.js`。

### 文档

- `docs/guide.md`（473 行）——面向**使用者**，通俗，四步走
- `docs/tech.md`（723 行）——面向**开发者**，§8.2 是自部署架构
- `github-app-guide.md` 已删除，6 处引用全部改指 `guide.md`

---

## 未了事项

### 1. npm 2.2.1 未发布

- `v2.2.1` 的 tag 与 GitHub Release **已创建**，但 npm 上只有 `2.2.0`
- 失败原因（已定位）：OIDC 交换返回 **404 package not found**

  ```
  POST /-/npm/v1/oidc/token/exchange/package/@aifire%2fgitalk → 404
  oidc Failed token exchange request ... package not found
  ```

- 含义：registry 上**没有记录这个包的 Trusted Publisher 配置**
- 排查手段：`npm trust list @aifire/gitalk`（需要登录态）
- 可用命令建配置（**必须带 `--allow-publish`**，否则只允许 `npm stage publish`）：

  ```bash
  npm trust github @aifire/gitalk       --file publish.yml --repo gitalk/gitalk --allow-publish
  npm trust github @aifire/gitalk-react --file publish.yml --repo gitalk/gitalk --allow-publish
  npm trust github @aifire/gitalk-vue   --file publish.yml --repo gitalk/gitalk --allow-publish
  ```

- 已发布的 `@aifire/*` 三个包都有 `0.0.0-stage` 占位版本（npm 首次认领包名时产生，
  `dist-tags.latest` 已正确指向 2.2.0，无害）

### 2. CloudBase 公网访问

见「下一步」1–4。已排除的路：

- 默认域名是**系统内部域名**，CLI 拒绝在其上建路由
  （`manual creation or modification is not supported`）
- 默认域名控制台标注为「仅限开发测试使用，存在访问频率限制、功能缺失」
- `--access-type EO`（EdgeOne，本可免证书自动续期）→ **体验版不支持**
- `--access-type CDN` / `DIRECT` → 都需要自带证书

---

## x.certbot 评估（`/Volumes/Pluto/dev/github/aispin/x.certbot`）

**结论：能满足大部分需求，但缺一环，需要「增量扩展」而不是改它。**

已具备：

| 能力 | 位置 |
| --- | --- |
| 阿里云 DNS-01 | `plugins/dns/aliyun.sh`（另含 `tencentcloud.sh`） |
| cron 自动续期 | `CRON_ENABLED` / `CRON_SCHEDULE` |
| 中文域名 punycode | `scripts/domain_utils.sh` |
| 证书输出到挂载目录 | `CERT_OUTPUT_DIR`、`CREATE_METADATA` |
| **更新后钩子** | `POST_RENEWAL_SCRIPT`（由 `scripts/deploy-hook.sh` 调用，入参 `RENEWED_LINEAGE`） |
| GitHub Actions 示例 | `docs/certbot-renew-example.yml`（157 行） |
| Webhook 通知 | `WEBHOOK_URL` |

**缺的一环：没有「上传到腾讯云 SSL + 重绑 CloudBase」的能力。**

建议的扩展方式（**不动现有文件**）：钩子跑在容器**内部**，装 `tccli` 不现实；
所以让钩子照原样把证书复制到 `CERT_OUTPUT_DIR`，**由容器外的编排层**做上传与重绑：

```
x.certbot 容器（签发/续期，证书落到挂载目录）
        ↓ 证书指纹变化时
tccli ssl UploadCertificate  → certId
        ↓
tcb domains edit/add --certid
        ↓
健康检查
```

编排层放 **GitHub Actions 定时任务**（而不是本机 cron）：不依赖你的机器开机、
凭据放仓库 secrets、有运行历史可审计，而且这个仓库本来就在用 Actions。

---

## 落地页端点切换（设计已定，未实现）

`apps/landing/src/app.tsx` 的 `GitalkDemo` 现在是：

```tsx
const options = {
  clientID: 'Iv23liM54pLB6TIqnqb6',
  proxy: 'https://gitalk-proxy.aispin-abf.workers.dev',
  owner: 'gitalk', repo: 'gitalk', admin: ['booxood'],
  id: 'gitalk-demo-thread', number: 442, backend: 'discussions', perPage: 10
}
```

改成：

```tsx
const ENDPOINTS = [
  { label: 'Cloudflare',      proxy: 'https://gitalk-proxy.aispin-abf.workers.dev' },
  { label: '腾讯云 CloudBase', proxy: 'https://gitalk.xsin.work/gitalk' }
]
```

**关键**：用 `key={endpoint.proxy}` 让组件在切换时**重新挂载**——否则 `options` 变了
但组件不重新初始化，切换看起来没反应。

**GitHub App 回调可以两个共存**（一个 App 最多 10 个 Redirect URI）：

```
https://gitalk-proxy.aispin-abf.workers.dev/oauth/callback
https://gitalk.xsin.work/gitalk/oauth/callback
```

**落地页留在 GitHub Pages**（`gitalk.github.io`），不迁 CloudBase。

---

## 凭据（`.env`，只列键名）

位置：`packages/proxy-worker/.env`（**已 gitignore**，三个目标共用这一份）

| 键 | 用途 |
| --- | --- |
| `GITHUB_APP_ID` / `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub App |
| `GITHUB_APP_PRIVATE_KEY` | **留空**——脚本会去读 `.pem` 文件 |
| `SESSION_ENCRYPTION_KEY` | 64 hex，`openssl rand -hex 32` |
| `GITALK_ALLOWED_ORIGINS` | `https://gitalk.github.io,http://127.0.0.1:4181` |
| `CLOUDFLARE_API_TOKEN` | CF 部署 |
| `CLOUDBASE_SECRET_ID` / `_SECRET_KEY` / `_ENV_ID` | CloudBase（子账号 `ai-matrix-dev`） |
| `ALIYUN_SECRET_ID_DNS` / `ALIYUN_SECRET_KEY_DNS` | 阿里云 DNS-01（`LTAI` 前缀） |

私钥文件：`packages/proxy-worker/gitalk-x.2026-10-15.private-key.pem`（已 gitignore）

**部署命令**

```bash
pnpm --filter @gitalk/proxy-worker deploy      # CF
pnpm --filter @gitalk/proxy-cloudbase deploy   # CloudBase
pnpm --filter @gitalk/proxy-node build         # 容器（再 docker build）
```

---

## 在这个环境里干活的坑（重要，能省很多时间）

沙箱限制导致下面这些必须加前缀/参数，否则会以很难懂的方式失败：

| 症状 | 解法 |
| --- | --- |
| CloudBase CLI 报 `EPERM ... ~/.config/.cloudbase` 或 `~/cloudbase-framework/logs` | 前面加 `HOME=/tmp/cbhome XDG_CONFIG_HOME=/tmp/cbhome/.config` |
| `npm` / `npx` 报 `EPERM ... ~/.npm/_cacache` | `npm_config_cache=/tmp/npmcache` |
| `gh` 报 `EPERM ... ~/.cache/gh` | `XDG_CACHE_HOME=/tmp/ghcache` |
| curl 访问 `127.0.0.1:<port>` 返回别的服务的页面 | 加 `--noproxy '*'`（环境里有 HTTP 代理会劫持 localhost） |
| `wrangler` 报 `EPERM ... ~/Library/Preferences/.wrangler/logs` | 非致命，可忽略；或 `WRANGLER_HOME=/tmp/wrangler-home` |
| `tcb` 的 bin 名是 `tcb`（不是包名），`npx @cloudbase/cli` 会失败 | 直接调 `packages/proxy-cloudbase/node_modules/.bin/tcb` |

---

## 已经踩过的坑（别再踩）

**GitHub API**

- 所有请求必须带 `User-Agent`，否则返回 **403 而不是 401**，且错误信息极具误导性。
  Workers 运行时不自带，Node/curl 会自带——所以本地怎么试都正常。
- 条件请求（`If-None-Match`）返回 **304 时不消耗额度**——但**两次请求的 `Accept` 头必须
  完全一致**，否则 ETag 不同、返回 200。我早先「304 也扣额度」的结论就是这个坑导致的误判。

**CloudBase**

- `protocolType` 字段会被 CreateFunction 拒绝（`ProtocolType 取值与规范不符`），zip 部署的
  Web 函数**不能带**这个字段
- HTTP 函数（Web 云函数）**不是**平台特有的 handler 签名，而是「监听 **9000** 端口、
  由 `scf_bootstrap` 启动的进程」——所以容器产物能逐字节复用
- `cloudbaserc.json` 的 `envVariables` 是**明文写在配置文件里**（schema 原文），所以该文件
  **绝不能带值**；用 `{{env.X}}` 从本地 `.env*` 插值（已实测生效）
- 默认域名不接受手工路由；自定义域名要求**已 ICP 备案** + 有效证书

**平台差异（易出事）**

| | 部署凭据 | 运行密钥 |
| --- | --- | --- |
| Cloudflare | API Token（可按模板限定） | `wrangler secret`，**只写、控制台不可回读** |
| CloudBase | 腾讯云 API 密钥（**默认可操作全账号**） | 环境变量，**控制台可读** |

**环境事实**

- `*.workers.dev` 在中国大陆**屏蔽率 100%**（GreatFire 实测）→ 只部署 CF 时国内用户
  **能读但永远登不上**。被墙的是「域」不是 Cloudflare，绑自定义域名通常可达
- 讨论区 #442 真实数据是 **2 顶层 + 1 回复 = 3 条**（`gitalk/gitalk`）
- 落地页 demo 指向 `number: 442`；`id: 'gitalk-demo-thread'` 是个**不存在的讨论**（死配置，
  因 `number` 优先所以不影响功能）

---

## 验证基准

改任何与读取相关的东西后，用这个比对（三端应返回一致）：

```bash
curl -s -X POST <端点>/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ repository(owner:\"gitalk\",name:\"gitalk\"){ discussion(number:442){ comments(first:20){ totalCount nodes { replies(first:20){ totalCount } } } } } }"}'
# 期望：顶层 2 + 回复 1
```

本地全量校验：

```bash
pnpm -r --filter "./packages/**" run typecheck   # 5 个包
npx vitest run                                   # 68 个测试
node scripts/check-publishable.mjs               # 发布入口点自检
```

---

## 相关 issue / 讨论

- `gitalk/gitalk#475`：2 顶层 + 4 回复（另一个可用的比对基准）
- `gitalk/gitalk#442`：demo 用的那个（2 + 1）
