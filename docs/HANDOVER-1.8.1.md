# Gitalk v1（1.8.1）停更收尾 — 交接说明

- 面向：v1 维护者
- 执行：2026-10-16 ｜ 状态复核：2026-10-18（远端状态与执行当天一致）
- 背景：`1.8.1` 是 v1 的收官版本，v1 就此停更，用户引导至 v2（<https://gitalk.github.io>）
- 相关仓库：`gitalk/gitalk`（`v1` 与 `gh-pages` 分支）、`gitalk/gitalk.github.io`

---

## 1. 已完成（可直接核验）

| 事项 | 结果 |
|---|---|
| `v1`（原 `master`，已改名） | `e800f21` = `706d6bd`（4 个 PR 合入 + 修复 + axios 0.19.2→0.29.0 + `dist/` 停止入库 + EOL 文档）+ 1 个 docs 提交（链接随改名更新） |
| tag `v1.8.1` | annotated，指向 `706d6bd`（已推送，未随改名/清理变动） |
| GitHub Release | [v1.8.1 — final Gitalk 1.x release (end of life)](https://github.com/gitalk/gitalk/releases/tag/v1.8.1)，用 `--latest=false` 创建（v2 的 release 仍保持 Latest） |
| EOL 提示 | `readme.md` / `readme-cn.md` / `readme-zh.md` 顶部横幅 + `CHANGELOG.md` 的 1.8.1 段；Demo 链接改为 `https://gitalk.github.io/gitalk/`，并新增 v2 链接 |
| `package.json` | `homepage: https://gitalk.github.io`（引导 v2） |
| v1 演示页 | `gitalk/gitalk` 的 `gh-pages`：<https://gitalk.github.io/gitalk/>（内容取自 `gitalk/gitalk.github.io@master`，favicon 改相对路径 + `.nojekyll` + EOL 横幅） |
| 仓库卡片 | description 改为 v2 导向 |

验证记录（执行当天）：`npm run lint` 通过、`npm test` 38/38、`npm run build`（含 min）通过、`npm pack` 69 文件且含 `dist/`、`https://gitalk.github.io/gitalk/` 返回 200 并显示 EOL 横幅；`pages/builds/latest` = `built`。

---

## 2. 遗留 #1：npm 发布 + 停更标记（需要 npm 凭据）

> ⚠️ **执行前先看 §7**：如果决定改以 `dev` 分支为基线、融合本次 PR 逻辑后**覆盖重发 1.8.1**，则下面的"发布 + deprecate"顺序必须按 §7.4 调整 —— 两条路径互斥（见 §7.2 第 3 条）。
> `gitalk@1.8.1` **尚未发布**（2026-10-18 复核：npm `latest` 仍为 `1.8.0`），所以两种选择都还来得及。

```bash
sudo chown -R 501:20 ~/.npm      # 当前本机 npm 因缓存属主异常报 EPERM（视环境而定）
npm login
git clone -b v1 https://github.com/gitalk/gitalk.git /tmp/gitalk-v1-release
cd /tmp/gitalk-v1-release
git checkout v1.8.1                                # 发布"被验证过的那次提交"；v1 分支上另有 docs 提交
git rev-parse HEAD                                 # 应为 706d6bd（= v1.8.1 tag 所在提交）
npm publish                                        # prepublishOnly 会自动 build；dist 不入库但会进包
npm deprecate "gitalk@<2.0.0" "Gitalk 1.x is end-of-life (final release 1.8.1). Please migrate to Gitalk 2.x: https://gitalk.github.io — npm i @aifire/gitalk"
```

发布后 `gitalk@latest` = 1.8.1（收官版，README/包页带 EOL 提示）；v2 是另一个包名 `@aifire/gitalk`，不受影响。

---

## 3. 遗留 #2：v1 演示页「登录跳转」不对（唯一功能缺陷）

### 现象

在 <https://gitalk.github.io/gitalk/> 点 **Login with GitHub** 后，没有正确回到 `/gitalk/`。

### 已排除的原因（都实测过，不用重复排查）

| 怀疑点 | 结论 |
|---|---|
| 页面发出的 `redirect_uri` 不对 | **不是**。`src/gitalk.jsx:167-176` 用 `redirect_uri: window.location.href`，在 `/gitalk/` 上发出的就是 `https://gitalk.github.io/gitalk/`（线上加载的 `gitalk@1.8.0` 产物也已核对，逻辑一致） |
| OAuth App 已失效 / secret 过期 | **不是**。用页面里公开的 client 凭证探测 token 端点：真凭证 + 假 code → `bad_verification_code`；换错 secret → `incorrect_client_credentials` → app 与 secret 均有效 |
| v1 默认的换 token 代理已下线 | **不是**。`https://cors-anywhere.azm.workers.dev/https://github.com/login/oauth/access_token` 仍在线，响应头带 `access-control-allow-origin: https://gitalk.github.io` |
| 页面里的 `accessToken` 失效导致报错 | **不是**（见 §4 第 3 条）：它从未被使用，且失效后会被静默忽略，页面走匿名 v3 REST 正常渲染评论 |

### 根因

GitHub 只会把用户重定向到**该 OAuth App 设置里注册的 callback URL**（官方文档 *Authorizing OAuth apps → Redirect URLs*：`redirect_uri` 省略时跳"第一个 callback URL"；wildcard matching 关闭时必须完全一致，开启时要求 host 精确且路径为其子目录）。而这个 app（`clientID e46f6dec7c07145c652c`）是在 v1 演示页还挂在**根站** `https://gitalk.github.io/` 时创建的，其注册回调没有覆盖现在的 `/gitalk/`。

**并且这个 app 不属于 gitalk 组织**：`https://github.com/organizations/gitalk/settings/applications` 列表为空 → 它归**某个个人账号**（或另一个组织）所有。

### 修复（只有 app 所有者能做；OAuth App 的 callback 无法用 API 改）

1. 先定位所有者：
   - 最简单的办法：在演示页点一次 **Login with GitHub**，看 GitHub 授权页上 `Authorize … by …` 写的是谁；
   - 或者（若你曾授权过它）打开 `https://github.com/settings/connections/applications/e46f6dec7c07145c652c`，页头会显示 app 名称与归属。
2. 进入该 app 的设置页：
   - 个人：`https://github.com/settings/developers` → **OAuth Apps** 标签 → 按 Client ID 找到它 → 详情页 `https://github.com/settings/applications/<app_id>`
   - 组织：`https://github.com/organizations/<owner>/settings/applications` → 详情页
   - ⚠️ 别点错门：`https://github.com/settings/applications`（无 `/developers`）是"我**授权过**的应用"列表，改不了 callback。
3. 把 **Authorization callback URL** 设为 `https://gitalk.github.io/gitalk/`，点 **Update application**。
   - 若想同时保住根站：保留 `https://gitalk.github.io/` 并确认该条的 **wildcard matching 开启**（`/gitalk/` 作为子目录即匹配）。但根站现在是 v2，不需要它。
4. 验证：回演示页点登录，地址栏应带 `?code=` 回到 `/gitalk/`，随后 gitalk 用上面那个代理换 token，并把 code 从 URL 抹掉（`history.replaceState`）。

### 若找不到 app 所有者

- **新建一个 OAuth App**（可建在 gitalk 组织下：`https://github.com/organizations/gitalk/settings/applications` → New OAuth App），把页面里的 `clientID`/`clientSecret` 换掉，callback 设 `https://gitalk.github.io/gitalk/`；
- 或者**把该页定位成只读存档**：删掉页面里 3 个凭证、用 CSS 隐藏 `.gt-btn-login`，横幅写明"登录/发评论请用 Gitalk 2.x"。改动很小，也和"轮换或删除这个旧 OAuth App"的方向一致。

---

## 4. 事实清单（省去重复排查）

1. `gitalk/gitalk` 的 `gh-pages` 现在是 v1 演示页（`bf12dec`）；此前那份是 gitalk-bot 早先推入的 v2 落地页构建，未被任何站点服务。v2 的落地页由 `main` 的 `deploy-pages.yml` 推到 **`gitalk/gitalk.github.io`**，服务根站 `https://gitalk.github.io/`，与本仓库 gh-pages 互不影响。
2. 本仓库 Pages 已启用：legacy / source `gh-pages` / URL `https://gitalk.github.io/gitalk/`。
3. 演示页里的 `accessToken`（`6a2f4d91…`）：**① 已失效**（`GET /user` → 401 `Bad credentials`）；**② gitalk v1 从不读 `options.accessToken`**（全仓库确认，token 只从 `localStorage(GT_ACCESS_TOKEN)` 取，由 OAuth 换 token 写入 / logout 清除）。因此这行配置无效，删除它不会有任何行为变化，也不是安全风险点。
4. 演示页里的 `clientSecret` 是真实有效的，且按 v1 设计必须暴露在前端（用于 Basic auth 读接口 + 换 token）。
5. 演示页结构：`index.html` + `favicon.ico` + `.nojekyll`；渲染 `gitalk/gitalk#1`（label `Gitalk,Demo`，存在）；组件从 `unpkg.com/gitalk@latest` 加载（当前 = 1.8.0，发布 1.8.1 后自动变成 1.8.1）。

---

## 5. 安全处置建议

- 旧 OAuth App 的 `clientSecret` 已在公开仓库/页面里多年且仍有效：建议**轮换或删除**该 app（v2 的 `docs/tech.md` 也已把它列为待处置的安全问题）。删除前请先决定 §3 的处理方式（否则演示页登录会直接失效）。
- 若不打算修登录，建议先做"只读存档"改造再去删 app，避免页面留着坏掉的登录入口。
- 已失效的 `accessToken` 可以不处理（它本来就没被使用），但建议顺手从页面删掉，避免后人误以为它有用。

---

## 6. 分支改名：`master` → `v1`（2026-10-16）

用的是 GitHub 的 **Rename a branch** API（`POST /repos/gitalk/gitalk/branches/master/rename`），不是"新建 + 删除"，所以辅助动作都自动完成了：

- **旧 URL 自动重定向**：`blob/master/...` → 302 → `blob/v1/...`；`tree/master` → 302 → `tree/v1`（已实测）→ 外部博客/文档里的老链接不会 404。
- **open PR 的 base 自动改写**：#519 的 base 已从 `master` 变为 `v1`。
- **tag / Release 不受影响**：`v1.8.1`（`902ab7b` → `706d6bd`）与 EOL Release 原样。
- **默认分支仍是 `main`**，v2 与 Pages（`gh-pages`）均不受影响。
- 仓库内残留引用已随 `e800f21` 清理：三个 readme 的跨语言链接、travis/coveralls badge 指向；贡献指南与 PR 模板改为引导 `main`（1.x 已停更）。
- 远端已无 `master` 分支。

⚠️ **给已有本地克隆的人（重要）**：本地那个 `master` 现在指向已被删除的远端分支。**不要执行 `git push origin master`** —— 远端 ref 已不存在，那会被当成"新建分支"，把陈旧的 `master` 重新推出来。建议：

```bash
git fetch --prune
git branch -m master v1      # 或者：git branch -D master
```

---

## 7. 关于 `dev` 分支：是否以它为基线、融合 1.8.1 的 PR 逻辑后覆盖重发（**待 v1 负责人判断**）

> 这一节不改动任何东西，只把事实、约束和两条路径摊开，供决策。

### 7.1 `dev` 是什么（实测）

| 项 | 值 |
|---|---|
| 血统 | 从 `409cd99`（2024-07-30 的老 master 顶端，即现在的 `v1`）分出；merge-base = `409cd99` |
| 独有提交 | 5 个：`3b48bd0 chore(release): v1.8.0` → `ec33781 chore: add test case` → `0d56d5c feat!: rewrite in TypeScript with Preact X and Vite` → `38ac956 fix: read options from ref…` → `d656c4d fix: make container text and icon colors adapt to dark theme` |
| 最后活动 | 2026-07-06（截至 2026-10-18 未再变动） |
| 技术栈 | TypeScript 6 + Preact 10 + Vite 8 + vitest 4 + eslint 10 + happy-dom；`src/` 全为 `.ts/.tsx`（`src/core/github/{rest,graphql,auth}.ts`、`src/components/Gitalk.tsx`、`src/styles/gitalk.css`） |
| 包身份 | 仍叫 **`gitalk`**、version **1.8.0**、`files:["dist"]` + `exports` 映射（ESM/UMD/min/react） |
| 分叉规模 | dev 独有 5 个提交 ↔ v1 独有 16 个提交（本次全部改动都在 v1 侧） |
| 健康度（本机 Node 26） | `npm ci` ✓、`tsc --noEmit` ✓、**vitest 11 项失败**；根因是环境级：`window.localStorage` 为 undefined（`vitest.config.ts` 已设 `environment: 'happy-dom'`、happy-dom 20.10.6 已安装）→ 疑为 happy-dom 20 与 Node 26 不兼容。dev 的 CI 矩阵是 Node 20/22，需在 20/22 上复核 |
| PR 现状 | `dev` 未受保护；**历史上从未有 PR 以 `dev` 为 base**（一直是直接 push 维护）；`ci.yml` 为 `on: pull_request:`（无分支过滤）→ 以 dev 为 base 的 PR 会跑 lint/typecheck/test/build（Node 20/22） |

**定性：`dev` 是 v1 的"破坏性重写"线路（`feat!`，TS + Preact X + Vite），不是 v1 的补丁线。**

### 7.2 决定选项的关键约束

1. **硬合并不可行（实测）**：`git merge-tree --write-tree dev v1` → **34 个文件冲突**，且含 `modify/delete`（dev 已删除/改名 `src/gitalk.jsx`、`src/util.js`、`src/component/*.jsx`、`dev/index.js` 等，而 v1 又改了它们）。合并会把 v1 的 JS/JSX/stylus 文件重新抬回来与 TS 重写并存，等于放弃这次重写。**只能手工移植逻辑，不能 merge。**
2. **npm 上 `1.8.1` 尚未发布**（`latest` 仍为 `1.8.0`）→ **"覆盖重发 1.8.1" 现在是可行的**。一旦发布，npm 同版本不可覆盖，只能发新版本。
3. **1.8.1 的定位是"v1 收官 + 引导 v2"**：readme/CHANGELOG 的 EOL 横幅、GitHub Release 说明（final 1.x release / end of life）、仓库卡片、以及 §2 里那条 `npm deprecate gitalk@<2.0.0` 都指向"这条线结束"。→ **"以 dev 为基线重发" 与 "v1 EOL 宣告" 在叙事上互斥，必须二选一**。
4. **tag / Release 的处理**：若走 dev 路线且仍要 `1.8.1`，需要 re-point tag `v1.8.1`（现指向 `706d6bd`）并编辑已存在的 GitHub Release；若已按今天的方式发布过 npm，则只能改发新版本号。
5. **版本语义**：dev 的 `feat!` 是破坏性变更，把它发成补丁号 `1.8.1` 在 semver 上是错的；而 dev 仍占用 `gitalk` 这个包名，与 v2 的 `@aifire/gitalk` 的关系也需要一并决定。

### 7.3 本次 1.8.1 里的改动，搬到 `dev` 的价值

| 本次改动 | 对 dev | 依据 |
|---|---|---|
| **#446 REST 倒序分页（逻辑）** | ✅ **值得移植** | dev `src/core/github/rest.ts:getIssueComments` 只有 `{per_page,page}`，没有倒序处理；`options.pagerDirection`（`'last' \| 'first'`）仍在 → 同样的缺口 |
| **#308 a11y label（逻辑）** | ✅ **值得移植** | dev 全仓库无 `<label>`/`htmlFor`，缺口仍在；i18n key `leave-a-comment` 已有 |
| #587 主题 / 暗色 | ⚠️ **不要移植** | dev 已有另一套更完整的方案：`data-gitalk-theme="dark\|auto"` + `prefers-color-scheme`（默认无属性=浅色），`options.ts` 里没有 `theme` 选项 → 会造成双主题系统与 API 冲突 |
| #540 labels 归一化 | ❌ 不要移植 | dev 类型为 `labels: string[]`，列表查询 `join(',')`、创建直接传数组，完全符合官方契约；引入对象形式只会削弱类型 |
| #566 / #596 axios 安全修复 | ➖ 不适用 | dev 已无 axios（自有 fetch 层），运行时依赖只剩 `preact` → 两个 CVE 在 dev 上不存在 |
| dist 不入库 / `.npmignore` / precommit 脚本 | ➖ 不适用 | dev 本就不跟踪 `dist`，打包走 `files:["dist"]` + vite + `exports`；套用 v1 的 packaging 会破坏其发布 |
| 本次新增的测试（jest / moxios / sinon） | ❌ 不能移植 | dev 用 vitest 4 + happy-dom + @testing-library，需按 dev 的栈重写 |
| EOL 文档 / 仓库卡片 / v2 导向 / Demo 链接 | ❌ **绝对不能合** | dev 保留 `gitalk` 包名且是 1.8.0 的破坏性重写，EOL 文案会"自我宣告死亡"并把自己的用户导走 |
| 分支改名相关引用 | ❌ 不适用 | v1 专属；dev 侧反有遗留：`ci.yml` 仍是 `branches: [master, dev]`（`master` 已删） |

**小结：真正值得从本次工作里带到 dev 的只有 2 项（#446、#308）；其余要么 dev 已有更好实现，要么不适用，要么会自相矛盾。**

### 7.4 若决定走 `dev` 路线，建议的执行顺序

1. **先验基线**：在 Node 20/22 上跑通 dev 的 `npm ci && npm run lint && npm run typecheck && npm test && npm run build`。基线不绿就先修基线。
2. **手工移植** 7.3 中标注 ✅ 的两项（#446 → `src/core/github/rest.ts` + `src/components/Gitalk.tsx`；#308 → 同文件 + `src/styles/gitalk.css`），用 vitest 补用例；**不要 `git merge v1`**。
3. **收尾 dev 自身**：`ci.yml` 的 `branches: [master, dev]` → `[v1, dev]`；readme 里的 `blob/master` 链接。
4. **走 PR 流程**（可选但推荐）：dev 未保护、CI 会在 `pull_request` 触发 → 两个独立 PR（base 都设 `dev`）分别承载 #446 与 #308 的移植，容易回滚与评审。
5. **发布动作二选一（互斥）**：
   - **A. 按本方案收尾（推荐，若 dev 不打算继续）**：把 v1.8.1 作为 v1 的 EOL 版本发布 → `npm publish` + `npm deprecate`；dev 另行决定归档或停用。
   - **B. 改为 dev 基线后覆盖重发 1.8.1**：必须在 **npm 发布之前**决定；若仍用 `1.8.1`，需 re-point tag `v1.8.1`、编辑已有 GitHub Release、更新 readme/CHANGELOG 的 EOL 表述，并且**不要**执行 `npm deprecate`；若 `1.8.1` 已发布过，则只能以新版本号（如 `1.9.0` / `2.0.0`，顾及 `feat!` 的破坏性）发布。
6. **包名/版本决策**：dev 的破坏性重写不建议用补丁号发布；是否继续占用 `gitalk` 包名、与 v2 `@aifire/gitalk` 的关系，需要产品层面拍板。

### 7.5 本次收尾没有做的事

- 对 `dev` **没有任何写入、合并、PR**；
- **没有执行 `npm publish` / `npm deprecate`**（执行环境未登录 npm）；
- dev 的健康度仅在 Node 26 下验证过，故"红"的结论标注为环境级、需在 20/22 复核；
- 关于 dev 的判断均为静态分析 + 隔离克隆实测（`git merge-tree`、`npm ci`、`vitest`），未改动 dev 分支内容。
