# `gitalk.xsin.work` 证书自动化：Let's Encrypt → 腾讯云 SSL → CloudBase

域名与 DNS 在阿里云，站点接入腾讯云 CloudBase HTTP 网关的自定义域名。本目录的脚本用 acme.sh
以阿里云 DNS-01 向 Let's Encrypt 申请并续期 `gitalk.xsin.work`，每次证书换新后自动上传到腾讯云 SSL，
并把 CloudBase 域名重绑到新证书，全程无人工介入。

## 1. 文件与调用链

| 文件 | 职责 |
|---|---|
| [`issue-and-install-gitalk.sh`](./issue-and-install-gitalk.sh) | 一次性：前置检查 → 安装 acme.sh（缺失时）→ `--issue` 签发 → `--install-cert` 复制到稳定路径并注册续期钩子 |
| [`deploy-cert-to-cloudbase.sh`](./deploy-cert-to-cloudbase.sh) | 续期钩子：上传证书到腾讯云 SSL → 取 `CertificateId` → 重绑 CloudBase 域名 → 回读校验。幂等，可手工重跑 |

acme.sh 由官方安装脚本装到 `~/.acme.sh/`，两个脚本都用绝对路径调用它。

```
acme.sh cron（每天 4 次 --cron）
 └─ 到续期窗口 → --renew
     └─ _installcert()：先把证书复制到 /etc/ssl/gitalk.xsin.work/，再 eval --reloadcmd
         └─ deploy-cert-to-cloudbase.sh
             ├─ tcb login --apiKeyId/--apiKey            提供腾讯云密钥时登录，否则沿用已有登录态
             ├─ tcb domains ls --filter Domain=…         读云端当前绑定的 CertId
             ├─ tcb api ssl UploadCertificate            上传 fullchain + privkey，取 CertificateId
             ├─ 新旧 CertId 相同 → 直接退出（幂等分支）
             ├─ tcb domains edit --certid <新ID> -e <env> 底层是 ModifyHTTPServiceRoute
             ├─ tcb domains ls --filter Domain=…         回读校验，不一致则以失败退出
             └─ tcb api ssl DeleteCertificate            仅在 DELETE_OLD_CERT=1 时执行
```

CloudBase 存的是证书 ID 指针而不是证书内容，续期产生新的 `CertificateId`，因此**必须显式重绑**。

## 2. 凭据与最小权限

### 2.1 阿里云（DNS-01 域名验证）

| 项 | 值 |
|---|---|
| 凭据 | RAM 用户的 AccessKeyId / AccessKeySecret |
| 变量名 | `Ali_Key` / `Ali_Secret`（acme.sh `dns_ali` 插件，大小写敏感） |
| 最小权限 | `alidns:DescribeDomainRecords`、`alidns:AddDomainRecord`、`alidns:DeleteDomainRecord` |
| 授权范围 | 只授权 `xsin.work` 这个域名资源 |
| 创建入口 | <https://ram.console.aliyun.com/users> |

acme.sh 首次签发时会把这两个变量写进 `~/.acme.sh/account.conf`，后续续期不需要再 export。

### 2.2 腾讯云（上传证书 + 重绑域名）

| 项 | 值 |
|---|---|
| 凭据 | 子账号的 API 密钥 SecretId / SecretKey，**不要用主账号** |
| 脚本变量名 | `TCB_SECRET_ID` / `TCB_SECRET_KEY`（传给 `tcb login --apiKeyId/--apiKey`） |
| 环境 ID | `CLOUDBASE_ENV_ID`，形如 `env-xxxx` |
| SSL 权限 | 预设策略 `QcloudSSLFullAccess`，或自定义策略只给 `ssl:UploadCertificate` / `ssl:DescribeCertificates` / `ssl:DeleteCertificate` |
| CloudBase 域名权限 | 不需要额外的 SSL 策略，走 `tcb:*` / `cdn:Tcb*`；给子账号云开发预设策略即可 |
| 创建入口 | <https://console.cloud.tencent.com/cam> |

不要用「环境级 API Key」（`tcb login --cloudbase-api-key`）：它走服务端固定模型，没有为单个 Key
追加任意 CAM 策略的通道，`ssl:UploadCertificate` 会失败。

## 3. 配置项

`issue-and-install-gitalk.sh`：

| 变量 | 默认 | 说明 |
|---|---|---|
| `Ali_Key` / `Ali_Secret` | — | 必填，阿里云 RAM AccessKey |
| `CLOUDBASE_ENV_ID` | — | 必填 |
| `CERT_DOMAIN` | `gitalk.xsin.work` | 证书域名 |
| `ACME_SERVER` | `letsencrypt` | 必须显式指定，acme.sh 默认 CA 是 ZeroSSL |
| `KEY_LENGTH` | `2048` | RSA 2048 |
| `ACME_EMAIL` | `admin@xsin.work` | ACME 账户邮箱 |
| `ACME_HOME` / `ACME` | `~/.acme.sh` | acme.sh 安装位置 |
| `SSL_DIR` | `/etc/ssl/$CERT_DOMAIN` | 证书稳定路径 |
| `HOOK` | 同目录的 `deploy-cert-to-cloudbase.sh` | 续期钩子 |
| `LOG_FILE` | `/var/log/gitalk-cert.log` | 钩子日志 |

`deploy-cert-to-cloudbase.sh`：

| 变量 | 默认 | 说明 |
|---|---|---|
| `TCB_SECRET_ID` / `TCB_SECRET_KEY` | 空 | 两个都提供时才 `tcb login`，留空则沿用已有登录态 |
| `CLOUDBASE_ENV_ID` | — | 必填 |
| `CERT_DOMAIN` | `gitalk.xsin.work` | 证书域名 |
| `CERT_FULLCHAIN` / `CERT_PRIVKEY` | `/etc/ssl/$CERT_DOMAIN/{fullchain,privkey}.pem` | 文件缺失时回退到 acme.sh 注入的 `CERT_FULLCHAIN_PATH` / `CERT_KEY_PATH` |
| `CERT_ALIAS` | `LE-$CERT_DOMAIN-<UTC 时间戳>` | 证书在腾讯云 SSL 控制台里的显示名 |
| `STATE_DIR` | `/var/lib/cloudbase-cert` | 记录上一次的 `CertificateId` |
| `DELETE_OLD_CERT` | `0` | 设为 `1` 时删除上一张证书 |
| `NODE_BIN` / `TCB_BIN` | 自动解析 | 显式指定可执行文件绝对路径 |

`NODE_BIN` / `TCB_BIN` 的解析顺序是「显式变量 → 仓库内 `node_modules/.bin`（`packages/proxy-cloudbase`
已把 `@cloudbase/cli` 钉成 devDependency）→ PATH」。cron 的 PATH 很精简，所以脚本自己解析绝对路径。

## 4. 首次落地

```bash
export Ali_Key="<阿里云 RAM AccessKeyId>"
export Ali_Secret="<阿里云 RAM AccessKeySecret>"
export CLOUDBASE_ENV_ID="env-xxxx"
export TCB_SECRET_ID="AKID..."
export TCB_SECRET_KEY="..."

bash docs/cert-automation/issue-and-install-gitalk.sh
```

脚本依次执行：前置检查 → 缺失时用 `curl https://get.acme.sh | sh` 安装 → `--issue --server letsencrypt
-d gitalk.xsin.work --dns dns_ali --keylength 2048` → `--install-cert` 到 `/etc/ssl/gitalk.xsin.work/`。
`--install-cert` 在复制完证书后**立刻执行一次 `--reloadcmd`**，所以这一步就完成了首次上传与重绑。

前置条件：域名需已完成 ICP 备案（`tcb domains add` 的硬性要求）；首次绑定自定义域名还要在阿里云 DNS
加一条 CNAME，值从下面这条命令的输出里取：

```bash
tcb domains ls -e "$CLOUDBASE_ENV_ID" --filter "Domain=gitalk.xsin.work" --json -y
```

首次绑定用 `tcb domains add gitalk.xsin.work --certid <CertificateId> -e "$CLOUDBASE_ENV_ID" -y`
（`CertificateId` 见钩子日志的一行 `腾讯云 SSL CertificateId = …`）；已绑定过的域名由钩子的
`domains edit` 更新，不要再 `add`。

## 5. 续期与手动演练

续期由 acme.sh 自己管理：安装时写入 crontab，每天 4 次执行 `acme.sh --cron`，到达续期窗口才真正续期，
续期后重放 `--reloadcmd`。没有 cron 的环境自行包一个 systemd timer 跑 `acme.sh --cron`。

手动演练一次续期（不要等 60 天后才发现钩子坏了）：

```bash
~/.acme.sh/acme.sh --renew -d gitalk.xsin.work --force
tail -n 50 /var/log/gitalk-cert.log
```

日志出现 `腾讯云 SSL CertificateId = …`、`重绑 CloudBase 域名 …`、`校验通过` 即成功。证书换新后
手工再跑一次钩子是安全的：云端已绑定同一张证书时命中幂等分支，输出 `云端已绑定该证书，无需操作`。

## 6. 实测验证过的行为

- `bash -n` 语法检查通过。
- 用一个假的 `tcb` 可执行文件做过端到端演练（不触网、不用真凭据）：上传 → 解析 `CertificateId` →
  `domains edit` → 回读校验全流程 exit 0；二次执行命中幂等分支。
- 证书与私钥不匹配时 exit 1，并给出腾讯云会返回的 `FailedOperation.CertificateMatchError` 提示。
- JSON 解析助手对四种响应形态都验证过：`{"data":{"Domains":[…]}}`、`{"Domains":[…]}`、
  `{"data":{"CertificateId":…}}`、`{"Response":{"CertificateId":…}}`。

那个假 `tcb` 演练用的 stub 没有随这两个脚本一起入库，因此这条演练目前无法直接从仓库复现。

## 7. 尚未对真实接口验证的部分

本方案没有对真实云接口发过请求（无凭据）。以下几点需要在真实环境的第一次运行里确认：

- 真实的 Let's Encrypt 签发与阿里云 DNS TXT 记录增删。
- 真实的腾讯云 `ssl.UploadCertificate`、`ssl.DeleteCertificate`，以及 CloudBase
  `domains edit` / `ModifyHTTPServiceRoute`。
- `tcb api ssl UploadCertificate` 是否被 CLI 的 `api_blacklist` 拦截（该模块只拦数据库账号密码类操作，
  不含 ssl，但未实测）。
- `tcb domains ls --json` 的实际字段名（`json_find_certid` 递归查找 `Domain` → `CertId`，对形状不敏感）。
- ECC 私钥能否上传腾讯云 SSL：`UploadCertificate` 文档只出现 RSA 私钥，所以默认用 `--keylength 2048`。
- 首次绑定的域名归属权 TXT 校验，以及 CloudBase 侧的 ICP 备案前置校验。

## 8. 设计要点

- 用 acme.sh 而不是 certbot / caddy：官方内置并持续维护阿里云 DNS 插件 `dns_ali`，只用 `curl` + `openssl`，
  `--reloadcmd` 又正好能挂上传动作；acme.sh 官方没有腾讯云 deploy hook，上传那一步本来就要自己写。
- 用 RSA 2048，规避「ECC 私钥能否被腾讯云 SSL 接受」这个不确定性。
- 每次续期都重绑域名，因为 CloudBase 只存 `CertId` 指针。
- 全链路只用 `bash` + `node`（仓库已要求 Node ≥ 20）+ `tcb`，不依赖 `jq` / `tccli` / `python`。

---

## 附：另一套多域名自动化（不属于本仓库）

另有一份面向多域名、跑在 GitHub Actions 上的证书自动化（腾讯云 CloudBase + 阿里云 CAS/CDN/DCDN），
属于独立的 `x.certbot` 项目。它目前不在任何仓库的正式路径下，只存在于本工作区被 gitignore 的暂存目录
`.x-certbot-delivery/files/`，尚未落地。本文档描述的是 gitalk 仓库内的本机方案，两者互不影响。
