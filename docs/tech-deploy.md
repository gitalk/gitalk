# Gitalk 2.0 自部署技术方案

端点（token exchange）要部署到哪个平台、为什么这么分层、各平台的机制与凭据模型差异。

面向使用者的操作步骤见 [guide.md](./guide.md)；整体技术设计见 [tech.md](./tech.md)。

---

## 概览：一个端点，三种目标

面向使用者的操作步骤见 [docs/guide.md](./guide.md)；这里讲**为什么这么设计**。

## 为什么要三个目标，而不是只做 Cloudflare

`*.workers.dev` 在中国大陆**屏蔽率 100%**（GreatFire 实时测量）。而登录必须经过端点：

```
浏览器 → <端点>/oauth/authorize → github.com → 回到 <端点>/oauth/callback
```

所以只部署在 Cloudflare 上时，中国大陆用户**能读评论**（读取是浏览器直连 `api.github.com`），
但**永远登录不了**。对一个读者主要在国内的项目，这不是「多支持一个平台」的问题。

> 注意被墙的是 `workers.dev` 这个**域**，不是 Cloudflare 本身。绑自定义域名的 Worker
> 通常可达（流量落到香港/日本/新加坡，慢但不被墙）。所以海外用户用 CF、国内用户用国内云，
> 是可用性而非偏好问题。

## 分层：逻辑与运行时解耦

端点逻辑**从来没有 Cloudflare 特有代码**——它只用 `Request` / `Response` / `crypto.subtle` / `fetch`，
而这几样 Node 20 全部原生提供。它只是一直待在 Worker 的入口文件里。所以按运行时拆分：

```
packages/proxy-core/      平台无关：handle(request, env, ctx) → Response
packages/proxy-worker/    CF Workers 入口（4 行 default export）
packages/proxy-cloudbase/ 腾讯云 CloudBase（复用 proxy-node 的构建产物）
packages/proxy-node/      Node http ↔ Web Request 适配 + Dockerfile
```

加一个目标 = 写一个入口文件，**不用碰逻辑**。

## 三种目标的运行机制

| 目标 | 平台形态 | 入口 | 适配成本 |
| --- | --- | --- | --- |
| Cloudflare Workers | V8 isolate，Web 标准原生 | `export default { fetch }` | 0 |
| CloudBase | **Web 云函数**（`type: HTTP`） | `scf_bootstrap` 拉起一个监听 **9000** 端口的进程 | 复用容器产物 |
| 容器 / VPS | 任意 Node 20+ | `node dist/server.js` | ~90 行 http↔Web 适配 |

CloudBase 的 Web 云函数**不是**平台特有的 handler 签名，而是一个「监听指定端口、由 `scf_bootstrap`
启动」的进程——所以 `packages/proxy-node` 的构建产物被**逐字节复用**为云端函数代码，端点逻辑
一份都没有重复。

容器产物是 **16KB 零依赖单文件**（`proxy-core` 无任何运行时依赖），Dockerfile 只需
`COPY dist/server.js`。

## 认证与密钥模型：三端差异很大

这是最容易出事的地方，三家的语义**并不等价**：

| | 部署凭据 | 权限范围 | 运行密钥 |
| --- | --- | --- | --- |
| Cloudflare | API Token | **可按模板限定到 Workers** | `wrangler secret`，**只写、控制台不可回读** |
| CloudBase | 腾讯云 API 密钥 `SecretId/SecretKey` | ⚠️ **默认可操作账号下全部资源** | 云函数环境变量，**控制台可读** |
| 容器 | 无（自己执行） | — | 环境变量 / `--env-file` |

两条由此得出的硬性要求：

1. **CloudBase 绝不能用主账号密钥**。必须建子账号并只关联 `QcloudAccessForTCBRole`
   （官方为此提供的预设策略；注意它含对象存储/云函数/日志/监控/VPC 的读写权限，
   属于「受限于这些服务、但不限于本项目」的范围）。
2. **App 私钥在 CloudBase 上的静态可读性弱于 CF**。CF 的 secret 写入后无法从控制台读出；
   CloudBase 的环境变量可以。文档里必须说清楚，别把控制台权限给错人。

## 密钥的存放：配置提交，值不提交

CloudBase 要求把环境变量声明在 `cloudbaserc.json` 里，而 schema 明确写着
`envVariables` 是**「明文写在配置文件中，创建时自动加密」**。所以该文件**绝不能带值**，
改用官方支持的模板变量从本地 `.env*` 插值：

```jsonc
// cloudbaserc.json —— 提交进仓库
"envId": "{{env.CLOUDBASE_ENV_ID}}",
"envVariables": { "GITHUB_APP_PRIVATE_KEY": "{{env.GITHUB_APP_PRIVATE_KEY}}" }
```

三个目标共用同一份 `packages/proxy-worker/.env`，由各自的部署脚本读取：

- 私钥支持两种来源——环境变量（单行 `\n` 转义或多行均可）或**直接放一个 `.pem` 文件**
  （`GITHUB_APP_PRIVATE_KEY_FILE`）。下载下来的 `.pem` 本来就是文件，往环境变量里塞 1.7KB
  是更差的选择，所以 CF 的部署脚本会优先找文件、容器与 CloudBase 也认这条路径。
- 容器入口在启动时**校验配置并快速失败**，直接报出缺了哪些键。否则缺配置会一路拖到请求时
  才以 `Invalid keyData` 或一个语焉不详的 GitHub 401 暴露出来。

## 实测结论与已知限制

| 事项 | 结果 |
| --- | --- |
| CF：拆分后功能回归 | 授权参数、匿名读（2 顶层 + 1 回复）、错误回跳 302 均与拆分前一致 |
| 容器：与 CF 逐项比对 | 健康检查、授权跳转、匿名读**完全一致** |
| CloudBase：运行时能力 | Node v20.19.3，`crypto.subtle` / `fetch` / `Request` / `Response` 均可用（用探针函数实测） |
| CloudBase：部署 | 成功（`Type=HTTP`、`Status=Active`） |
| CloudBase：公网访问 | ✅ `https://gitalk.xsin.work`（根路径路由，无前缀） |

**自定义域名的三个前置条件**（我们最终走通了，记录以供复用）：

1. **域名归属校验**：`tcb domains add` 会要求先加一条 TXT
   （`_cloudbase-challenge.<子域>` = 环境 ID），加完再执行一次。
2. **证书**：体验版不支持 `--access-type EO`（EdgeOne 托管证书，本可免维护），
   `DIRECT` / `CDN` 都要求自带证书。做法是 Let's Encrypt 签发后上传：
   ```bash
   tcb api ssl UploadCertificate --api-version 2019-12-05 \
     --body '{"CertificatePublicKey":"<fullchain>","CertificatePrivateKey":"<key>","CertificateType":"SVR","Repeatable":false}' --json -y
   tcb domains add <域名> --certid <CertificateId> -e <envId>
   ```
   注意 `--api-version` 必须显式传，否则报 `version=undefined`。
3. **ICP 备案**：CLI 帮助文本写明「需要域名已完成 ICP 备案」——这是行政前置，不是代码问题。

**默认域名不能用于生产**：`*.app.tcloudbase.com` 被控制台标注为「仅限开发测试使用，
存在访问频率限制、功能缺失」，且 CLI 拒绝在其上创建路由
（`domain ... is a system internal domain`）。

**证书换新后必须重绑**：CloudBase 存的是 `CertId` 指针，而 Let's Encrypt 每次续期都是
新证书 → 新 ID → 不重绑就不生效。

`protocolType` 字段也被 CreateFunction 拒绝（`ProtocolType 取值与规范不符`），
zip 部署的 Web 函数不能带它。
