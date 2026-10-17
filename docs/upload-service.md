# 设计文档：基于 GitHub App 的单仓库图床服务

> 这是一份**自包含**的设计文档，供独立项目使用。它不依赖任何特定前端，Gitalk 只是第一个消费者。

## 1. 问题

很多运行在浏览器里的应用需要「让访客上传一张图片，然后得到一个可长期引用的 https URL」。GitHub 没有公开的图片上传 API：

- 评论/issue 的 body 只是 Markdown 字符串，图片必须已经托管在别处；
- `user-images.githubusercontent.com` 是 CDN，不是 API；
- `gh` CLI 用到的 `POST uploads.github.com/user-attachments/assets` 是**未公开端点**，且浏览器 CORS 不通。

现成服务（postimages、imgur、PicX 等）各有问题：没有 API、需要第三方账号、或者（PicX）要求把**整个仓库的写权限**交给一个宽权限 App。

**本项目的目标**：一个自托管的、权限最小化的、把图片存进**某一个指定 GitHub 仓库**的上传服务。

## 2. 非目标

明确**不做**：

- 不是通用图床（不追求公开可写、不追求 CDN、不做图片编辑/水印/裁剪）
- 不做用户体系（不注册账号、不做个人空间）
- 不代理读取（图片直接由 `raw.githubusercontent.com` / jsDelivr 提供，不走本服务）
- 不做内容审核网络（只提供删除接口与日志）

## 3. 核心设计：独立的 GitHub App

**这是整个方案最重要的一条。**

新建一个**独立于任何消费方**的 GitHub App，它的全部权限只有：

```
Repository permissions:
  Contents: Read and write     ← 唯一权限
  Metadata: Read-only          ← 创建 App 时自动带，必需
```

其余全部 **No access**。

### 3.1 为什么必须独立

对比：现有评论类产品（如 Gitalk、giscus）用的是「评论 App」。**不要**给那个 App 加 `contents: write`：

| 做法 | 后果 |
| --- | --- |
| 给评论 App 加写权限 | 全局变更：所有已安装站点都要重新授权；评论 App 的 token 从「只读评论」变成「能改仓库内容」；一旦 proxy 被攻破，攻击者可改博客源码 → **站点接管** |
| **独立上传 App（本项目）** | 爆炸半径被压到**一个空仓库**：token 泄露最多往 `assets` 仓库塞垃圾，动不了业务仓库 |

### 3.2 安装范围

App 只安装在**一个仓库**上（下称 `assets` 仓库）：

- 必须是 **public**（私有仓库的 raw URL 需要鉴权，GitHub Camo 匿名抓不到）
- 建议**关闭** CI、Actions、Pages、issue、wiki，只当作存储
- 建议**独立于业务仓库**（不要用博客仓库本身，避免污染其历史与 CI）

### 3.3 每次签发 token 时再收窄一次

GitHub 允许把 installation token 收窄到 App 权限的子集：

```http
POST /app/installations/{installation_id}/access_tokens
{
  "repositories": ["assets"],
  "permissions": { "contents": "write" }
}
```

**必须每次都传这两个字段**。拿到全量 installation token 就等于放弃单仓库边界。

## 4. 架构

```
调用方（浏览器 / 服务端）
   │  POST /upload   (multipart 或 raw binary)
   │  Authorization: Bearer <调用方凭据>
   ▼
本服务（CF Worker / Node）
   │  1. 鉴权 + 配额 + 类型/大小校验
   │  2. 取 installation token（收窄至 assets 仓库 + contents:write）
   │  3. Git Data API 写文件
   ▼
GitHub  ──►  assets 仓库（新 commit）
   │
   └─ 返回：https://raw.githubusercontent.com/<owner>/assets/<branch>/<path>
```

### 4.1 为什么用 Git Data API 而不是 Contents API

- **Contents API**：`PUT /repos/{o}/{r}/contents/{path}`，一个文件一个 commit
- **Git Data API**：`blob → tree → commit → ref`，**一次提交写多个文件**

批量上传（用户一次选 4 张图）应该产生**一个 commit**，而不是 4 个。

写流程：

```
POST /git/blobs        (每个文件一个 blob，encoding: base64)
GET  /git/ref/heads/<branch>
POST /git/trees        (base_tree = 当前 tree, 加入新 blob)
POST /git/commits
PATCH /git/refs/heads/<branch>
```

并发冲突（`409`/`422`）时用**新的 head** 重试，最多 3 次。

## 5. HTTP 接口

所有响应都是 JSON，除 `POST /upload` 的入参。

### `POST /upload`

```
Content-Type: multipart/form-data
Authorization: Bearer <token>
body: files[]  (1..4 个)
```

成功 `200`：

```json
{ "files": [
  { "url": "https://raw.githubusercontent.com/o/assets/main/uploads/2026/10/ab12….png",
    "path": "uploads/2026/10/ab12….png",
    "width": 1280, "height": 720, "bytes": 48213, "sha": "ab12…" }
] }
```

失败：见 §7。

### `DELETE /upload`

```
Authorization: Bearer <token>
body: { "paths": ["uploads/YYYY/MM/<sha>.<ext>"] }
```

- **只允许删除本服务写入过的路径**（用固定前缀 + 文件名格式校验，不接受任意路径）
- 删除同样是 commit（Git 历史不会回收空间，这一点要写进运维文档）

### `GET /health`

返回 `{ ok, repo, branch, quota }`，不需要鉴权。

## 6. 校验规则（缺一不可）

### 6.1 文件

| 项 | 规则 |
| --- | --- |
| 数量 | 1–4 个/请求 |
| 大小 | **≤ 5 MB/文件**（跨平台最稳：CloudBase SCF 同步请求上限 6 MB） |
| 类型 | **按 magic bytes 判断**，不看 `Content-Type` |
| 允许 | PNG、JPEG、GIF、WebP、AVIF |
| **禁止** | **SVG、HTML、XML**（可执行脚本，等同 XSS 投递）、任何压缩包 |
| 尺寸 | 解码后 ≤ 4096×4096 且 ≤ 20 MP（防 decompression bomb） |
| EXIF | 上传前剥离（隐私） |

### 6.2 路径

```
uploads/YYYY/MM/<sha256-of-bytes>.<ext>
```

- **内容哈希命名**：天然去重、同名不覆盖、CDN 缓存不会被串
- 不用用户提供的文件名（路径注入 + 不可控字符）

### 6.3 鉴权（调用方 → 本服务）

服务本身**不信任 Origin**（非浏览器客户端可以伪造）。按部署场景三选一：

| 模式 | 说明 | 适用 |
| --- | --- | --- |
| **API Key** | 运营方签发的一组 bearer token | 服务端调用、小规模 |
| **GitHub OAuth** | 复用调用方已有的 GitHub 登录态，服务端校验 token 后放行 | 面向匿名访客的应用（如评论区） |
| **Cloudflare Turnstile** | 人机校验，可与上面组合 | 公开可写的部署 |

**无论哪种，都必须有配额**（§6.4）。

### 6.4 配额

计数器**不能放进程内存**（Worker isolate 会重启、Serverless 实例会漂移）。用 KV / D1 / Redis 之一。

建议初值：

```
每调用方：10 / 小时，50 / 天
全站：    100 / 天，500 MB / 天，5 GB 总量（硬上限）
```

超限返回 `429` + `Retry-After`。

> **5 GB 是硬上限**：Git 历史只增不减，删文件不回收空间。到上限就拒绝并告警，不要指望「定期清理」。

## 7. 错误约定

| 状态 | 含义 |
| --- | --- |
| `400` | 参数缺失/非法路径 |
| `401` | 缺少或无效的调用方凭据 |
| `413` | 文件过大 |
| `415` | 类型不支持（SVG/HTML 走这里） |
| `422` | 图片无法解码（损坏或伪装） |
| `429` | 配额用尽（带 `Retry-After`） |
| `502` | 上游 GitHub 失败 |
| `503` | 服务未配置或主动关闭 |

**客户端约定**：任何失败都应回退到「让用户粘贴图片 URL」，而不是让上传按钮卡住。

## 8. 配置

| 变量 | 说明 |
| --- | --- |
| `GITHUB_APP_ID` | 上传 App 的 ID |
| `GITHUB_APP_PRIVATE_KEY` | 私钥（PEM；CI 用 secret，本地用文件路径） |
| `GITHUB_APP_INSTALLATION_ID` | 该 App 在 assets 仓库上的安装 ID |
| `ASSETS_OWNER` / `ASSETS_REPO` / `ASSETS_BRANCH` | 目标仓库与分支 |
| `PUBLIC_BASE_URL` | 返回 URL 的前缀（默认 raw.githubusercontent.com） |
| `AUTH_MODE` | `api-key` \| `oauth` \| `turnstile` |
| `API_KEYS` | `AUTH_MODE=api-key` 时的合法 key 列表 |
| `MAX_FILE_BYTES` | 默认 5 242 880 |
| `MAX_FILES` | 默认 4 |
| `QUOTA_*` | 各档配额 |

**私钥永不进前端、永不进响应、永不进日志。**

## 9. 部署形态

同一份核心逻辑，三个适配层（**与 Gitalk proxy 相同的做法**，可复用其结构）：

| 目标 | 说明 |
| --- | --- |
| **Cloudflare Workers** | 首选；免费额度足够；KV 存配额 |
| **Node** | 自托管；`server.ts` 适配 Request/Response |
| **腾讯云 CloudBase** | 国内；HTTP 函数监听 9000；**注意 6 MB 同步请求上限** |

要求：核心逻辑**平台无关**（Web 标准 `Request`/`Response`），适配层只做入口。

## 10. 安全清单

- [ ] App 只申请 `contents: write` + `metadata: read`
- [ ] App 只安装在一个 public 的 assets 仓库
- [ ] 每次签发 token 都传 `repositories` + `permissions`
- [ ] 私钥只在服务端，且支持从文件读（便于本地开发）
- [ ] 类型按 magic bytes 判断；SVG/HTML 明确拒绝
- [ ] 路径由服务端生成，不接受用户文件名
- [ ] 配额在持久存储里
- [ ] 日志不记录 token、不记录完整文件内容
- [ ] 有删除接口，且只允许删本服务写入的路径
- [ ] 明确告知运营方：**内容责任归仓库所有者**

## 11. 测试要点

- 鉴权：无凭据 → 401；错误 key → 401
- 类型：PNG/JPEG/WebP 通过；SVG → 415；伪装成 png 的 html（magic bytes 是 html）→ 415
- 大小：5 MB 通过；5 MB + 1 字节 → 413
- 数量：4 个通过；5 个 → 400
- 路径：返回的 path 匹配 `^uploads/\d{4}/\d{2}/[a-f0-9]{64}\.(png|jpe?g|gif|webp|avif)$`
- 去重：同一文件上传两次 → 相同 path，且**不产生第二个 commit**
- 批量：4 个文件 → **只有 1 个 commit**
- 配额：超限 → 429 且带 `Retry-After`
- 删除：只能删自己的路径；任意路径 → 400
- 上游失败：GitHub 5xx → 502，不泄露内部错误详情

## 12. 已知限制（写进 README，别藏着）

1. **存储只增不减**：Git 历史不会因删除而回收空间；5 GB 是硬上限
2. **raw.githubusercontent.com 有缓存**：默认约 5 分钟，删除后可能短时间仍可访问
3. **内容责任在仓库所有者**：公开可写 = 任何人能往里塞东西；上线前必须有删除流程与举报入口
4. **不做图片处理**：不压缩、不转格式、不生成缩略图（由客户端处理）
5. **GitHub 速率限制**：内容创建约 500/小时、80/分钟，配额设计不能超过它

## 13. 与其他方案的对比（供决策参考）

| 方案 | 权限 | 存储 | 滥用面 | 评价 |
| --- | --- | --- | --- | --- |
| GitHub 未公开上传端点 | 需 OAuth/PAT + 仓库写 | GitHub | 无 | ❌ 非公开 API，浏览器 CORS 不通 |
| postimages / imgur | 第三方账号 | 第三方 | 无 | ❌ 无 API 或需第三方账号 |
| PicX 模式 | **宽权限 App**（`administration`/`actions`/`deployments`…） | 用户仓库 | 无 | ❌ 权限过大；且它是 SPA 不是库、AGPL |
| **本项目** | **仅 `contents: write`，单仓库** | 指定仓库 | 中（需配额+删除） | ✅ 权限最小、可自托管、可复用 |

---

## 14. 部署示例

以下步骤假设你已经完成 §3 的 App 与仓库准备。

### 14.0 共同前置

```bash
# 1. 新建上传 App，只勾选：
#    Repository permissions → Contents: Read and write
#    （Metadata: Read-only 自动带上）
# 2. 生成并下载私钥（.pem），保存到服务端，不要提交进仓库
# 3. 新建 public 仓库 `assets`（关闭 Actions / Pages / Issues / Wiki）
# 4. 把 App 安装到这个仓库，记下 installation id
#    在安装页 URL 里能看到：.../installations/<installation_id>
```

### 14.1 Cloudflare Workers

**目录结构**

```
upload-worker/
├── wrangler.toml
├── src/index.ts          # 平台无关的 handle(request, env, ctx)
└── src/platform.ts       # CF 适配层：export default { fetch: handle }
```

**配额计数器用 KV**

```bash
wrangler kv namespace create UPLOAD_QUOTA
# 把输出的 id 填进 wrangler.toml
```

**`wrangler.toml`**

```toml
name = "repo-uploads"
main = "src/platform.ts"
compatibility_date = "2026-01-01"

[[kv_namespaces]]
binding = "QUOTA"
id = "<上一步输出的 id>"

[vars]
ASSETS_OWNER = "<owner>"
ASSETS_REPO = "assets"
ASSETS_BRANCH = "main"
AUTH_MODE = "api-key"
MAX_FILE_BYTES = "5242880"
MAX_FILES = "4"
```

**私钥与凭据用 secret，不要写进 toml**

```bash
wrangler secret put GITHUB_APP_PRIVATE_KEY   # 粘贴 .pem 全文
wrangler secret put GITHUB_APP_ID
wrangler secret put GITHUB_APP_INSTALLATION_ID
wrangler secret put API_KEYS                 # 逗号分隔
```

**部署与验证**

```bash
wrangler deploy
curl -s https://repo-uploads.<account>.workers.dev/health
# → {"ok":true,"repo":"assets","branch":"main"}
```

**参考限额**：免费版 100,000 请求/天；单次请求体上限约 100 MB（远高于我们的 5 MB 限制）。

### 14.2 腾讯云 CloudBase（HTTP 云函数）

CloudBase 的 HTTP 函数由三个硬性要求决定：**监听 9000 端口**、用 `scf_bootstrap` 启动、部署时必须 `--force`。

**目录结构**

```
upload-cloudbase/
├── cloudbaserc.json
├── functions/upload/
│   ├── scf_bootstrap        # 可执行，内容见下
│   ├── index.js             # 打包产物（esbuild 输出）
│   └── package.json
└── scripts/build.mjs
```

**`scf_bootstrap`**（必须可执行：`chmod +x`）

```sh
#!/bin/sh
export PORT=9000
exec node index.js
```

**`cloudbaserc.json`**

```json
{
  "envId": "{{env.CLOUDBASE_ENV_ID}}",
  "framework": { "name": "upload", "plugins": {} },
  "functionRoot": "./functions",
  "functions": [{
    "name": "upload",
    "type": "HTTP",
    "handler": "index.main",
    "runtime": "Nodejs18.15",
    "memorySize": 256,
    "timeout": 20,
    "envVariables": {
      "ASSETS_OWNER": "{{env.ASSETS_OWNER}}",
      "ASSETS_REPO": "assets",
      "ASSETS_BRANCH": "main",
      "AUTH_MODE": "api-key"
    }
  }]
}
```

> `{{env.X}}` 会在部署时从**当前目录的 `.env`** 插值。**secrets 不要写进 `cloudbaserc.json`**，用控制台环境变量或 `.env`（并 .gitignore）。

**部署**

```bash
tcb login
cd upload-cloudbase
npm run build            # esbuild 打成单文件 index.js
tcb fn deploy upload --force     # ⚠️ 不带 --force 会静默跳过，看起来"成功"但没更新
```

**踩过的坑（都是真实遇到的）**

| 坑 | 现象 | 正确做法 |
| --- | --- | --- |
| 不带 `--force` | 命令成功但函数没更新 | 永远 `--force` |
| 在仓库根目录执行 | 找不到 `cloudbaserc.json`，可能新建出错误的函数 | `cd` 到 `cloudbaserc.json` 所在目录 |
| 监听 8080/3000 | 函数健康检查失败 | 必须 `PORT=9000` |
| 同步请求体超 6 MB | 大文件上传失败 | 单文件 ≤ 5 MB（本项目默认值） |
| 默认域名 | 只能测试用，不能手工加路由 | 绑自定义域名（需备案 + 证书） |

**验证**

```bash
curl -s https://<env-id>.service.tcloudbase.com/upload/health
```

### 14.3 自托管 Node

```bash
node src/server.js
# 监听 PORT（默认 8787），核心逻辑与上面完全相同
```

需要额外的环境变量 `PUBLIC_ORIGIN`（如果服务在反向代理后面，用于拼对外 URL）。

### 14.4 冒烟测试（三种部署通用）

```bash
# 1. 健康检查
curl -s $BASE/health

# 2. 上传一张小图
curl -s -X POST $BASE/upload \
  -H "Authorization: Bearer $API_KEY" \
  -F "files=@./test.png"
# → 200，返回 url / path / sha

# 3. 再传一次同一张图
# → 相同 path，且 assets 仓库不产生第二个 commit（内容哈希去重）

# 4. 拒绝 SVG
curl -s -X POST $BASE/upload -H "Authorization: Bearer $API_KEY" \
  -F "files=@./test.svg"
# → 415

# 5. 拒绝超额
curl -s -X POST $BASE/upload -H "Authorization: Bearer $API_KEY" \
  -F "files=@./6mb.png"
# → 413

# 6. 无凭据
curl -s -X POST $BASE/upload -F "files=@./test.png"
# → 401
```
