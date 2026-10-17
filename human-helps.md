# 需要人工完成的事项

这个文件收集**只有人能做**的事：在网页上点、在本机运行、或者涉及你的账号与凭据。
代码层面的工作不需要出现在这里。

> 状态标记：`☐ 待办` / `☑ 已完成` / `⚠️ 注意`

---

## 1. ☑ 给主仓加 `DEPLOY_REPO_TOKEN_GITALK`

**已完成** ✓（2026-10-17 12:32 加入，已验证存在）。

用途：CI 把 `@aifire/gitalk-deploy` 的构建产物推送到 `gitalk/deploy`。
权限要求：fine-grained PAT，`contents: write` on `gitalk/deploy`。

---

## 2. ☑ 推送本地提交并触发第一次部署产物发布

**已完成** ✓（已由我在获得「自主推进」授权后推送）。以下保留说明，供你核对发生了什么。

```bash
cd /path/to/gitalk
git push origin main
```

推送后会自动发生：

1. **Deploy landing page** 工作流 → 落地页更新（含环境音、inline 模式等）
2. 打一个 tag 才会触发 **Publish deploy CLI**：

   ```bash
   git tag v2.0.0-beta.1 && git push origin v2.0.0-beta.1
   ```

   或手动触发：`Actions → Publish deploy CLI → Run workflow`

**验证产物仓库**：<https://github.com/gitalk/deploy> 应出现 `dist/` 与 `templates/`。

---

## 3. ☐ 修复 `@aifire/gitalk` 在 npm 上的旧版本

**现状**：`0.0.0-stage`、`2.2.0`、`2.3.0` 三个版本仍在，已 `deprecate` 但未删除。
`latest` 已指向 `2.0.0-beta.0` ✓。

**为什么卡住**：之前的 token 是 **Granular + 绕过 2FA** 类型，npm 禁止这类 token 执行
**破坏性操作**（unpublish），会返回 `403`。

两种做法：

```bash
# A. 网页删（每个版本右侧有删除入口，会要求 2FA）
#    https://www.npmjs.com/package/@aifire/gitalk?activeTab=versions

# B. 本地用走 2FA 的交互式会话
npm login
npm unpublish @aifire/gitalk@2.2.0
npm unpublish @aifire/gitalk@2.3.0
npm unpublish @aifire/gitalk@0.0.0-stage
```

⚠️ **72 小时窗口**：这三个版本是 2026-10-16 发布的，窗口即将过期。

---

## 4. ☐ 决定是否删除 `NPM_TOKEN` secret

**现状**：主仓有一个名为 `NPM_TOKEN` 的 secret，来源不明（可能是 v1 维护者，也可能是你）。
**已经不再被任何工作流引用** ✓ —— 我已经把发布工作流里读它的分支删掉了，现在固定走 OIDC。

```bash
gh secret list -R gitalk/gitalk          # 确认它还在
gh secret delete NPM_TOKEN -R gitalk/gitalk
```

留着不影响功能，但一个**权限不明的长期凭据**本身就是攻击面。

---

## 5. ☐ 发布 `2.0.0-beta.1` 到 npm

**为什么需要你**：它会把**今天的安全修复**推给用户。当前 npm 上的 `2.0.0-beta.0`
是今天早些时候的版本，**不含** open redirect 修复。

```bash
# 推送后触发（OIDC Trusted Publishing，无需任何 token）
Actions → Publish to npm → Run workflow
```

版本号会**自动递增**为 `2.0.0-beta.1`，三个包共用同一个号。

---

## 6. ☐ （可选）给代理加按 IP 限流

**现状**：匿名读走代理后有 **5,000 请求/小时** 额度，但**任何能访问 proxy 的人都能消耗**。
被刷满后，真实读者会降级到直连（60/小时）。

需要的是**持久化计数器**（Cloudflare KV / D1，或 CloudBase 侧的等价物）——
这是新增基础设施，脚本替不了你开通。

---

## 7. ⚠️ 本地验收清单

启动预览：

```bash
pnpm --filter @gitalk/landing dev -- --port 4181
# → http://127.0.0.1:4181/
```

**端口必须是 4181** —— `GITALK_ALLOWED_ORIGINS` 里只有它，换端口登录回跳会失败。

建议重点看：

- [ ] **Hero 右侧是真组件**，能登录、发评论、reaction、inline reply、`@` 提示
- [ ] **reaction 弹层**不再被裁（之前被滚动容器切掉）
- [ ] **排序图标**（右上角两个）点一下能切最新/最早
- [ ] **Inline 模式**：去边框、composer 上移、不吸底、不跳动
- [ ] **收起成悬浮球**，且**不被统计卡片遮挡**
- [ ] **导航不被 hero 内容遮挡**（滚动时变成磨砂）
- [ ] **环境音**：导航最右的图标，点开听四种季节音（默认按当月选）
- [ ] **图片上传**：未配置 `onUploadImage` 时按钮不出现（这是对的，不是 bug）

---

## 8. ☐ 域名与证书（仅在用自定义域名时）

**Cloudflare**：如果域名也在 Cloudflare，可以用 `gitalk-deploy` 自动绑（需在 App 里
勾选 `Workers Custom Domains` 权限）；否则需要人工加 **CNAME**，证书由平台自动签。

**CloudBase**：自定义域名需要 **ICP 备案** + 证书上传，**这两件脚本做不了**。
若用 Let's Encrypt，续期走 x.certbot 的定时任务。

**GitHub App 的 callback URL**：必须在 **App 设置页**手工加（org 所有的 App 不能用 API 改，
`PATCH /app` 会返回 404）。要加的是 `<你的代理地址>/oauth/callback`。
