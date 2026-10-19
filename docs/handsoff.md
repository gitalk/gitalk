# 交付状态

> **接入步骤的真源**：[`packages/gitalk-deploy/README.md`](../packages/gitalk-deploy/README.md)
> 与 [`README-CN.md`](../packages/gitalk-deploy/README-CN.md)（中英一一对应）。
> 根 README 与落地页只做一句话概述并链过去；`docs/guide.md` 保留手动部署细节，同样指向真源。
> 改步骤只改那两个文件，然后跑 `node scripts/check-docs.mjs` 确认没有漂移。

这个项目当前的开放事项**为零**。原 `human-helps.md` 里的三条已在 2026-10-18 关闭：

1. **代理按 IP 限流** —— 不实施。5,000/hr 的匿名读额度理论上可被第三方消耗，但当前用量远低于上限；等真的出现滥用再做，避免提前引入 KV/D1 这类基础设施。
2. **本地验收清单** —— 你把落地页跑起来逐一验过，通过。
3. **域名与证书** —— 不推进。自定义域名的做法（Cloudflare 直接绑、别处加 CNAME、CloudBase 需备案）已写进 `packages/gitalk-deploy/README.md` 与 `README-CN.md`，需要时照着做即可。

`npm` 上 `0.0.0-stage` / `2.2.0` / `2.3.0` 与主仓的 `NPM_TOKEN` secret 按决定**不再处理**：
前者已 `deprecate`、`latest` 指向 `2.0.0-beta.1`；后者已不被任何工作流引用。

## 当前发布状态

| 产物 | 位置 |
| --- | --- |
| 组件 | npm `@aifire/gitalk@2.0.0-beta.1`（连同 `-react` / `-vue`） |
| 部署 CLI | `npx github:gitalk/deploy -c .env -t cloudflare`（产物在 `gitalk/deploy`） |
| 落地页 | `gitalk.github.io` |
| 代理 | CF `gitalk-proxy.aispin-abf.workers.dev` / CloudBase `gitalk.xsin.work` |

## 已知但未处理

- **i18n 懒加载**：组件只有 `en` / `zh-CN` 内联、其余 9 个语言包一并打包（约 28 kB 源码）。懒加载需要代码分割，`dist/gitalk.js` 是 **IIFE 单文件**（`formats: ['iife']`），**做不到**；只有 ESM 消费者可能受益，而 IIFE 用户本来就拿不到这个优化。
- **落地页只有中/英**：要支持全部 11 种语言，需要翻译 9 份完整页面文案。
- **jsdom 下的偶发 unhandled error**：`vitest` 偶尔报，复跑即消失，270 个测试始终全过。
