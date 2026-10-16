# 交接文档（Handoff）

> 用途：换会话后凭这份文档接着干活。只写「现在在哪、还要做什么、哪里会踩坑」。
> 设计细节在 [tech.md](./tech.md) / [tech-deploy.md](./tech-deploy.md)，这里不重复。

---

## 一、当前状态

**两个托管端点 + 容器都已上线并通过端到端验证。**

| 目标 | 地址 | 验证 |
| --- | --- | --- |
| Cloudflare Workers | `https://gitalk-proxy.aispin-abf.workers.dev` | 健康检查、授权参数、匿名读、CORS 预检、错误回跳 302 |
| 腾讯云 CloudBase | `https://gitalk.xsin.work`（**根路径**，无前缀） | 同上 |
| 容器 | 本地 `8787` / 自部署 | 与 CF 逐项一致 |

三端匿名读结果一致：`gitalk/gitalk#442` = 顶层 2 + 回复 1。

**已发布**：npm `@aifire/gitalk@2.3.0`、`@aifire/gitalk-react@2.2.1`、`@aifire/gitalk-vue@2.2.1`
（OIDC Trusted Publisher + provenance 生效）；GitHub Release 与 tag `v2.3.0`。
主分支 `main` 干净，landing 已上中英切换，demo 可在两个端点间切换。

**包结构**

```
packages/proxy-core/       平台无关 handle(request, env, ctx) → Response
packages/proxy-worker/     CF Workers 入口
packages/proxy-node/       Node http ↔ Web Request 适配 + Dockerfile
packages/proxy-cloudbase/  CloudBase Web 函数（逐字节复用 proxy-node 的 dist/server.js）
packages/core|react|vue/   widget 与两个框架包装器
apps/landing/              gitalk.github.io 落地页
```

**验证基准**

```bash
# 三端应返回一致：顶层 2 + 回复 1
curl -s -X POST <端点>/graphql -H 'Content-Type: application/json' \
  -d '{"query":"{ repository(owner:\"gitalk\",name:\"gitalk\"){ discussion(number:442){ comments(first:20){ totalCount nodes { replies(first:20){ totalCount } } } } } }"}'

pnpm -r --filter "./packages/**" run typecheck
npx vitest run
node scripts/check-publishable.mjs
```

## 二、未决事项

> 1–3 以**已发布的 v2.3.0** 为准。

1. **`createIssueManually` 选项未补回**。v1 有这个选项（默认 `false` = 管理员访问即自动建楼），
   v2.3.0 固化为「管理员点按钮」，选项本身没实现。是否补回需决策。
2. **页面无 thread 时普通登录访客能否创建**：v1 不允许，当前也不允许（只有 `admin` 看到按钮）。
3. **Discussions 后端根本没有创建路径**（已核对代码）：`DiscussionsBackend.createThread()`
   无条件抛错，只有 Issues 后端会真的 `POST /issues`。所以默认后端下管理员点「初始化」必然失败。
   要么补 `createDiscussion` mutation，要么在 discussions 下隐藏按钮。
4. **发布 workflow 的版本门禁与包版本不匹配**（未修，下一次发版会踩）：`publish.yml` 用 **core 的
   版本**做「是否已发布」判断，却按各包自己的 `package.json` 发布。下次只有 core 递增时
   （react/vue 停在 2.2.1），门禁查不到 `react@2.3.x` 就重发 2.2.1 → `EPUBLISHCONFLICT` → job 失败。
   修法：各自读各自 `package.json` 的 version。
5. **x.certbot 交付未落地**。文件在 `.x-certbot-delivery/`（已 gitignore），落地命令见其 README。
   落地前**必须修正**：目标仓库已配好 **Environment `PROD`** 下的凭据，而交付的 workflow 既没写
   `environment: PROD`，用的也是另一套名字。正确的一组：
   - secrets：`ALIYUN_SECRET_KEY_DNS`、`CLOUDBASE_SECRET_KEY`
   - variables：`CLOUDBASE_SECRET_ID`、`ALIYUN_SECRET_ID_DNS`
   - job 需声明 `environment: PROD`，引用分别用 `secrets.X` / `vars.X`

## 三、关键陷阱

**CloudBase**

- `tcb fn deploy` 对已存在的函数**不带 `--force` 是空操作**（报成功、`UpdateTime` 不变、
  新 `envVariables` 不写入）；CLI **只在当前目录**找 `cloudbaserc.json`，从仓库根目录跑会建出坏函数。
- 函数内部跑在 `127.0.0.1:9000`，公网 origin **必须用 `PUBLIC_ORIGIN` 显式告知**，否则 OAuth
  回调指向内网地址，登录永远回不来。
- 端点必须挂**根路径**，触发路径设 `enablePathTransmission: false`——平台在函数收到请求前就
  剥掉前缀，`url.origin` 无法还原。
- `tcb api` 必须显式 `--api-version`；`tcb routes add/delete` 没有 `-y` 会交互确认；
  `protocolType` 会被 CreateFunction 拒绝。
- 自定义域名三关：归属 TXT 校验、自带证书（体验版不支持 EdgeOne 托管证书）、ICP 备案。
  **证书续期后必须重绑**——CloudBase 只存 `CertId` 指针。

**GitHub API**

- 所有请求必须带 `User-Agent`，否则返回 **403 而不是 401**，错误信息极具误导性。Workers 运行时
  不自带，Node/curl 会自带——本地怎么试都正常。
- 304 免额的前提是两次请求的 `Accept` 完全一致，否则 ETag 不同、返回 200。（当前实现**没有**
  接入 ETag 条件请求。）

**平台差异**

| | 部署凭据 | 运行密钥 |
| --- | --- | --- |
| Cloudflare | API Token（可按模板限定到 Workers） | `wrangler secret`，**只写、控制台不可回读** |
| CloudBase | 腾讯云 API 密钥（**默认可操作全账号**，须用子账号 + `QcloudAccessForTCBRole`） | 环境变量，**控制台可读** |

**本机沙箱**（不加这些前缀会以很难懂的方式失败）

| 症状 | 解法 |
| --- | --- |
| CloudBase CLI 报 `EPERM ... ~/.config/.cloudbase` 或 `~/cloudbase-framework/logs` | 前缀 `HOME=/tmp/cbhome XDG_CONFIG_HOME=/tmp/cbhome/.config` |
| `npm` / `npx` 报 `EPERM ... ~/.npm/_cacache` | `npm_config_cache=/tmp/npmcache` |
| `gh` 报 `EPERM ... ~/.cache/gh` | `XDG_CACHE_HOME=/tmp/ghcache` |
| curl 访问 `127.0.0.1:<port>` 拿到别的服务的页面 | 加 `--noproxy '*'`（环境代理会劫持 localhost） |
| `wrangler` 报 `EPERM ... ~/Library/Preferences/.wrangler/logs` | 非致命；或 `WRANGLER_HOME=/tmp/wrangler-home` |
| `npx @cloudbase/cli` 失败（bin 名是 `tcb`） | 直接调 `packages/proxy-cloudbase/node_modules/.bin/tcb` |

**其他**

- `*.workers.dev` 在中国大陆**屏蔽率 100%**：只部署 CF 时国内用户能读、永远登不上。被墙的是
  「域」不是 Cloudflare。
- 落地页 demo 依赖 `key={endpoint.proxy}` 触发重新挂载，去掉后切端点看起来没反应。
- `gitalk/gitalk#475`（2 顶层 + 4 回复）是另一个可用的比对基准。
- `gitalk/gitalk.github.io` 的 `master` 分支 `index.html` 仍硬编码旧 OAuth App 的 `clientSecret`
  （公开可读），待轮换或删除该 App。
