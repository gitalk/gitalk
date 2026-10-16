# `gitalk.xsin.work` 证书自动化：Let's Encrypt → 腾讯云 SSL → CloudBase

> 场景：域名与 DNS 在**阿里云**（NS `dns7/dns8.hichina.com`），站点接入**腾讯云 CloudBase** HTTP 网关自定义域名，
> 需要全自动签发/续期，并把新证书同步到腾讯云 SSL 与 CloudBase 域名绑定。
>
> **数据核对时间：2026-10-16。** 文中每个仓库的 star / 最近提交都来自当日 GitHub API 实测。
> 标注「✅ 已验证」= 读过官方文档 / 仓库源码 / SDK schema；标注「⚠️ 未验证」= 我的推断，落地前需自行确认。

---

## 0. 结论速览

| 问题 | 结论 |
|---|---|
| 推荐工具 | **acme.sh**（`dns_ali` 插件在官方仓库内、由官方维护、2026-07-12 还在改） |
| 阿里云凭据 | `Ali_Key` / `Ali_Secret`（RAM AccessKey，**变量名就是这两个**） |
| 证书文件 | `~/.acme.sh/gitalk.xsin.work/fullchain.cer` + `gitalk.xsin.work.key`（RSA 时无 `_ecc` 后缀） |
| 续期机制 | 安装时自动写入 **crontab**，每天跑 4 次 `acme.sh --cron`；续期后自动重放 `--reloadcmd` |
| 上传腾讯云 SSL | API 动作 **`UploadCertificate`**（`ssl` 服务，版本 `2019-12-05`），返回字段 **`CertificateId`** |
| 上传用什么跑 | 首选 **`tcb api ssl UploadCertificate`**（仓库里已有 `@cloudbase/cli@3.8.7`，零额外安装）；备选 `tccli` |
| 让域名用新证书 | **`tcb domains edit gitalk.xsin.work --certid <新ID> -e <envId>`**，不是 `domains add` |
| 会自动换新证书吗 | **不会。** CloudBase 存的是 `CertId` 指针，续期产生新 `CertId`，必须显式重绑 |
| 一站式项目 | [certimate](https://github.com/certimate-go/certimate)（9.4k★，支持阿里云 DNS + 腾讯云 SSL，但**无 CloudBase 域名 deployer**）、[certd](https://github.com/certd/certd)（5.1k★） |

**最大的一条现实障碍：`tcb domains add` 要求域名已完成 ICP 备案**（CLI 帮助文本原话：*"需要域名已完成 ICP 备案，并提供有效的 SSL 证书"*）。这是行政流程，不是技术问题，见 §7。

---

## 1. 工具选型（对应问题 1）

### 1.1 硬指标对比（2026-10-16 实测）

| 工具 | 仓库 | ★ | 最近提交 | 阿里云 DNS-01 | 用什么 | 额外依赖 |
|---|---|---|---|---|---|---|
| **acme.sh** ⭐推荐 | [acmesh-official/acme.sh](https://github.com/acmesh-official/acme.sh) | 47,824 | 2026-10-16 | ✅ **官方内置** `dnsapi/dns_ali.sh` | 纯 POSIX shell + curl + openssl | 无 |
| lego | [go-acme/lego](https://github.com/go-acme/lego) | 9,943 | 2026-10-14 | ✅ 官方内置 `providers/dns/alidns`（227 个 provider） | Go 单二进制 / 库 | 无 |
| certbot | [certbot/certbot](https://github.com/certbot/certbot) | 33,273 | 2026-10-15 | ❌ **官方没有阿里云插件**（官方只有 13 个 `certbot-dns-*`，无 aliyun） | Python | 必须装第三方插件 |
| caddy | [caddyserver/caddy](https://github.com/caddyserver/caddy) | 78,043 | 2026-10-16 | ⚠️ 靠第三方模块 [caddy-dns/alidns](https://github.com/caddy-dns/alidns)（71★，2026-04-26） | Go 二进制 | 需 `xcaddy` 自行编译 |

### 1.2 逐个说清楚「官方维护 + 是否还在更新」

**acme.sh —— 阿里云插件状态最健康的一个（✅ 已验证）**

- 插件文件就是官方仓库里的 [`dnsapi/dns_ali.sh`](https://github.com/acmesh-official/acme.sh/blob/master/dnsapi/dns_ali.sh)，不是社区 fork。
- 该文件的提交历史（GitHub API 实测）：
  - `2026-07-12` dns_ali: convert IDN domains to punycode
  - `2026-07-03` dns_ali: do not rely on `_url_encode upper-hex` …（修签名兼容性）
  - `2025-12-06` / `2025-12-05` / `2024-10-13`
  - → **官方在持续维护，最近一次是 3 个月前。**
- 依赖：只用 `curl` + `openssl`（脚本里用 `_hmac sha1` + `_base64` 自己算签名），**不需要 aliyun CLI，不需要 Node/Python**。
- 插件头部自述（源码注释原文）：
  ```
  dns_ali_info='AlibabaCloud.com
  Options:
   Ali_Key API Key
   Ali_Secret API Secret
  '
  ```
- 它调用的阿里云 API 动作（源码 `_add_record_query` / `_check_exist_query` / `_delete_record_query`）：
  `DescribeDomainRecords`、`AddDomainRecord`、`DeleteDomainRecord`（`https://alidns.aliyuncs.com/`，签名 `HMAC-SHA1`）。

**lego —— 同样官方维护，但更适合当库用（✅ 已验证）**

- 文档页 <https://go-acme.github.io/lego/dns/alidns/>，provider code `alidns`，**Since v1.1.0**。
- 环境变量（官方文档原文）：
  ```
  ALICLOUD_ACCESS_KEY / ALICLOUD_SECRET_KEY / ALICLOUD_SECURITY_TOKEN（可选）
  ALICLOUD_RAM_ROLE（用 ECS 实例 RAM 角色，免密钥）
  ALICLOUD_REGION_ID（默认 cn-hangzhou）、ALICLOUD_TTL（默认 600）…
  ```
- `providers/dns/alidns` 最近提交 2026-05-28（依赖升级），2026-05-04（文档修正）—— 活跃。
- 它**没有**腾讯云 SSL 的 deployer，上传那步照样得自己写。

**certbot —— 阿里云这条路是断的（✅ 已验证）**

- 官方仓库顶层只有 13 个 `certbot-dns-*` 插件：cloudflare、digitalocean、dnsimple、dnsmadeeasy、gehirn、google、linode、luadns、nsone、ovh、rfc2136、route53、sakuracloud —— **没有阿里云**。
- 只能用第三方：
  - [justjavac/certbot-dns-aliyun](https://github.com/justjavac/certbot-dns-aliyun) 384★，最近提交 2026-02-27 —— 还能用。
  - [tengattack/certbot-dns-aliyun](https://github.com/tengattack/certbot-dns-aliyun) 306★，**最近提交 2023-06-13** —— 基本停更，PyPI 上 `certbot-dns-aliyun` 停在 2.0.0。
- 结论：能用，但要自己承担插件停更风险，且要装 Python 环境。

**caddy —— 场景不匹配（✅ 已验证）**

- Caddy 的价值是「自己终结 TLS + 自动 HTTPS」。你的 TLS 终结点在**腾讯云 CloudBase**，本地跑 Caddy 没有意义。
- 而且 Caddy 核心不带任何 DNS provider，要用 [caddy-dns/alidns](https://github.com/caddy-dns/alidns)（71★）并用 `xcaddy` 重新编译 —— 为了一次 DNS-01 验证去编译一个 web server，性价比极低。

### 1.3 选型结论

**acme.sh。** 理由排序：官方维护的阿里云插件 + 零额外依赖 + `--reloadcmd` 钩子正好能挂我们的上传动作 + 仓库里已经有 Node/`tcb`，但 acme.sh 连 Node 都不需要。

> lego 是合格的备选，如果你更愿意用 Go 单二进制、又不介意自己写上传脚本，它更干净。
> certbot 和 caddy 在这个场景下不建议。

---

## 2. acme.sh 具体用法（对应问题 2）

以下命令均来自官方 README / 源码（✅ 已验证）。

### 2.1 安装

```bash
# 方式 A：在线安装（官方推荐）
curl https://get.acme.sh | sh -s email=you@example.com

# 方式 B：从源码装
git clone https://github.com/acmesh-official/acme.sh.git
cd acme.sh && ./acme.sh --install -m you@example.com
```

安装脚本做三件事（README 原文）：
1. 把 `acme.sh` 复制到 `~/.acme.sh/`（证书也放这里）；
2. 建 alias `acme.sh=~/.acme.sh/acme.sh`；
3. **自动创建 cron job 检查续期**。

> ⚠️ 装完要重开终端 alias 才生效；脚本里请一律用绝对路径 `~/.acme.sh/acme.sh`。

### 2.2 阿里云 DNS-01 需要的环境变量（变量名精确）

```bash
export Ali_Key="LTAI5t..."        # RAM 用户的 AccessKeyId
export Ali_Secret="xxxxxxxx"      # 对应 AccessKeySecret
```

- 变量名就是 **`Ali_Key`** 和 **`Ali_Secret`**（大小写敏感），不要再猜 `ALI_KEY` / `ALICLOUD_ACCESS_KEY`（那是 lego 的）。
- 首次签发时 acme.sh 会把它们**写进 `~/.acme.sh/account.conf`**（源码 `_saveaccountconf_mutable Ali_Key "$Ali_Key"`），所以后续续期不需要再 export。
- AccessKey 从阿里云 RAM 控制台取：<https://ram.console.aliyun.com/users>

### 2.3 签发 `gitalk.xsin.work`

```bash
~/.acme.sh/acme.sh --issue \
  --server letsencrypt \
  -d gitalk.xsin.work \
  --dns dns_ali \
  --keylength 2048
```

三个容易踩的点：

1. **必须显式写 `--server letsencrypt`。** acme.sh 的默认 CA 现在是 **ZeroSSL**（README 特性表里 ZeroSSL 标着 `⭐ Default`）。不写这一句，你拿到的是 ZeroSSL 证书，不是 Let's Encrypt。
2. `--dns dns_ali` 是插件名（不带 `.sh`）。
3. **`--keylength 2048`（RSA）是刻意选的**：`acme.sh` 的默认值是 `ec-256`（源码 `DEFAULT_DOMAIN_KEY_LENGTH=ec-256`），而腾讯云 SSL `UploadCertificate` 的文档示例只给了 `-----BEGIN RSA PRIVATE KEY-----`，**没有明确承诺接受 EC 私钥**（⚠️ 未验证）。首次落地用 RSA 2048 消除这个不确定性；想省体积以后可以再试 ECC。

### 2.4 证书产物落在哪、文件名叫什么

关键变量（源码 `_initpath`）：

- `CERT_HOME` 默认 = `LE_CONFIG_HOME` 默认 = `~/.acme.sh`
- 域名目录 = `$CERT_HOME/$domain`，ECC 时 = `$CERT_HOME/${domain}_ecc`（`ECC_SUFFIX="_ecc"`）
- 因为我们用 RSA 2048，**没有 `_ecc` 后缀**：

| 变量 | 实际路径 | 内容 |
|---|---|---|
| `CERT_KEY_PATH` | `~/.acme.sh/gitalk.xsin.work/gitalk.xsin.work.key` | 域名私钥 |
| `CERT_PATH` | `~/.acme.sh/gitalk.xsin.work/gitalk.xsin.work.cer` | 叶子证书 |
| `CA_CERT_PATH` | `~/.acme.sh/gitalk.xsin.work/ca.cer` | 中间 CA |
| `CERT_FULLCHAIN_PATH` | `~/.acme.sh/gitalk.xsin.work/fullchain.cer` | 叶子 + 中间 → **上传给腾讯云用这个** |
| `DOMAIN_CONF` | `~/.acme.sh/gitalk.xsin.work/gitalk.xsin.work.conf` | 续期配置（含 `Le_ReloadCmd`） |

> 如果你改成 ECC，路径变成 `~/.acme.sh/gitalk.xsin.work_ecc/…`，并且之后所有命令（`--install-cert` / `--renew`）都要加 `--ecc`。

**不要直接把 `~/.acme.sh/` 里的文件喂给外部程序**（README 明确警告："they are for internal use only, the folder structure may change"）。正确做法是 `--install-cert` 复制到稳定路径，再用稳定路径：

```bash
~/.acme.sh/acme.sh --install-cert -d gitalk.xsin.work \
  --key-file       /etc/ssl/gitalk.xsin.work/privkey.pem \
  --fullchain-file /etc/ssl/gitalk.xsin.work/fullchain.pem \
  --reloadcmd      "/opt/gitalk/deploy-cert-to-cloudbase.sh >>/var/log/gitalk-cert.log 2>&1"
```

`--install-cert` 的复制发生在 `--reloadcmd` **之前**（源码 `_installcert()`：先 `cat … >"$_real_fullchain"`，第 81 行才 `Running reload cmd`），所以 reloadcmd 里读 `/etc/ssl/…` 是安全的。

### 2.5 自动续期机制

**是 cron，不是 systemd timer。**（acme.sh 本身不提供 systemd unit。）

- 安装时调 `installcronjob`，自动往用户 crontab 写一条。**真实写法（源码 `installcronjob()`）是每天 4 次，不是 README 里写的每天 1 次**：

  ```
  <random_minute> <random_hour>,<+6>,<+12>,<+18> * * * "<LE_WORKING_DIR>"/acme.sh --cron --home "<LE_WORKING_DIR>" > /dev/null
  ```

  （分钟和起始小时由安装时刻的 unix time 取模随机化。）
- 手动安装/卸载：
  ```bash
  ~/.acme.sh/acme.sh --install-cronjob     # 手动补装
  ~/.acme.sh/acme.sh --uninstall-cronjob   # 卸载
  ```
- 无 cron 的环境（容器里常见）：源码会报
  `crontab/fcrontab doesn't exist, so we cannot install cron jobs.` 并提示你自己加一条 `acme.sh --cron`。
  这时用 systemd timer 自己包一层即可（见 §8.5）。

### 2.6 续期后怎么触发后续动作

**用 `--reloadcmd`。**它就是为这个设计的：

- 存进域名 conf 的 `Le_ReloadCmd`；
- 每次续期走 `_installcert()` 时，在证书文件复制完之后执行；
- 执行方式是 `cd "$DOMAIN_PATH" && eval "$_reload_cmd"`，并且**会先 export 这几个变量**（源码原文）：
  `CERT_PATH`、`CERT_KEY_PATH`、`CA_CERT_PATH`、`CERT_FULLCHAIN_PATH`、`Le_Domain`。

  → 所以你的钩子脚本可以只依赖 `$CERT_FULLCHAIN_PATH` / `$CERT_KEY_PATH`，不用写死路径。
- 钩子里可以放**任意 shell 命令**，我们就把「上传腾讯云 SSL + 重绑 CloudBase 域名」塞进去。
  注意它是 `eval`，路径/命令里别留裸空格，脚本给**绝对路径**。
- 其他可用钩子：`--pre-hook`、`--post-hook`、`--renew-hook`，以及 60 多个 deploy hook（`acme.sh --deploy -d x --deploy-hook nginx` 等）。

> ⚠️ **acme.sh 仓库里没有任何腾讯云的 deploy hook。** 63 个 deploy 脚本里只有 `ali_cdn`、`ali_dcdn` 两个阿里云相关，腾讯云一个都没有。所以「上传腾讯云 SSL」必须自己写 `--reloadcmd`（下面已给）。

---

## 3. 把证书上传到腾讯云 SSL 并拿到 certId（对应问题 3）

### 3.1 有没有现成 CLI / SDK

| 通道 | 状态 | 说明 |
|---|---|---|
| **`tcb api`**（CloudBase CLI 内置通用云 API 调用） | ✅ 已验证 | `@cloudbase/cli` v3.0.0+ 提供，v3.8.7 源码里 `cmd: 'api <service> <action>'` |
| `tccli`（腾讯云官方 CLI） | ✅ 已验证 | `pip install tccli`，仓库里带官方示例 `examples/ssl/v20191205/UploadCertificate.md` |
| 官方 SDK | ✅ 已验证 | Python/Go/Java/Node/PHP/.NET/C++ … 语言齐全，`tencentcloud-sdk-python` 当前 3.1.188 |

**推荐 `tcb api`**，因为你的仓库 `packages/proxy-cloudbase` 里已经把 `@cloudbase/cli@3.8.7` 作为 devDependency 钉死了，**零额外安装**，而且同一个 CLI 顺手就把域名重绑做了。

### 3.2 API 动作名与参数（官方文档）

动作：**`UploadCertificate`**，服务 `ssl`，版本 **`2019-12-05`**。
文档：<https://cloud.tencent.com/document/api/400/41665>

| 参数 | 必选 | 类型 | 说明（文档原文） |
|---|---|---|---|
| `CertificatePublicKey` | **是** | String | 证书内容。示例值：`-----BEGIN CERTIFICATE----****` |
| `CertificatePrivateKey` | SVR 时必填 | String | 私钥内容，证书类型为 SVR 时必填，为 CA 时可不填 |
| `CertificateType` | 否 | String | 默认 `SVR`。CA = CA证书，SVR = 服务器证书 |
| `Alias` | 否 | String | 备注名称 |
| `Repeatable` | 否 | Boolean | 相同指纹证书是否允许重复上传；默认 `true` |
| `ProjectId` / `Tags.N` / `KeyPassword` / `CertificateUse` | 否 | | |

**返回字段：`CertificateId`（String）**，另有 `RepeatCertId`（当 `Repeatable=false` 且命中同指纹时返回已存在的证书 ID）。

> **证书内容怎么传**：就是把 PEM 文件全文当一个 JSON 字符串塞进去，`\n` 转义由 JSON 序列化负责。
> `CertificatePublicKey` 用 **fullchain**（叶子+中间），不要只传叶子。

**关键坑（✅ 源码验证）：`tccli` 只支持 `--cli-input-json file://path` 读文件，单个参数不支持 `file://`。**
我读了 tccli 源码 `tccli/cli_input_json.py` 和 `tccli/argument.py`：`file://` 逻辑只存在于 `CliInputArgument`，普通字符串参数没有任何读文件逻辑。
所以要么 `--cli-input-json file://req.json`，要么 shell 里 `"$(cat fullchain.pem)"`。

### 3.3 三种可执行写法

**写法 A：`tcb api`（推荐，脚本里用这个）**

```bash
export CLOUDBASE_ENV_ID="your-env-id"
export TCB_SECRET_ID="AKID..."
export TCB_SECRET_KEY="..."

# 非交互密钥登录（源码 options：--apiKeyId / --apiKey；-y 抑制一切交互）
tcb login --apiKeyId "$TCB_SECRET_ID" --apiKey "$TCB_SECRET_KEY" -y

# 组装请求体（用 node 读 PEM，避免 jq 依赖）
REQ=$(node -e '
const fs=require("fs");
const o={
  CertificatePublicKey: fs.readFileSync(process.argv[1],"utf8"),
  CertificatePrivateKey: fs.readFileSync(process.argv[2],"utf8"),
  CertificateType: "SVR",
  Repeatable: false,
  Alias: "LE-gitalk.xsin.work"
};
process.stdout.write(JSON.stringify(o));
' /etc/ssl/gitalk.xsin.work/fullchain.pem /etc/ssl/gitalk.xsin.work/privkey.pem)

# 调用（ssl 的版本 2019-12-05 由 CLI 内置 ServiceVersionMap 自动补齐，不用写 --api-version）
tcb api ssl UploadCertificate --body "$REQ" --json -y
```

输出（`outputJson` 会包一层 `data`，源码 `outputJson`：`const output = { data }`）：

```json
{ "data": { "CertificateId": "DSAuy46E", "RepeatCertId": "", "RequestId": "..." } }
```

**写法 B：`tccli`**

```bash
pip install --user tccli
export TENCENTCLOUD_SECRET_ID="AKID..."
export TENCENTCLOUD_SECRET_KEY="..."
export TENCENTCLOUD_REGION="ap-shanghai"     # 注意：tccli 用带下划线的变量名

node -e '
const fs=require("fs");
process.stdout.write(JSON.stringify({
  CertificatePublicKey: fs.readFileSync(process.argv[1],"utf8"),
  CertificatePrivateKey: fs.readFileSync(process.argv[2],"utf8"),
  CertificateType:"SVR", Repeatable:false, Alias:"LE-gitalk.xsin.work"
}));' /etc/ssl/gitalk.xsin.work/fullchain.pem /etc/ssl/gitalk.xsin.work/privkey.pem > /tmp/ssl-req.json

tccli ssl UploadCertificate --cli-input-json file:///tmp/ssl-req.json
```

输出：`{"Response":{"CertificateId":"DSAuy46E","RepeatCertId":"...","RequestId":"..."}}`

> ⚠️ 变量名差异是真实的坑：**tccli 用 `TENCENTCLOUD_SECRET_ID` / `TENCENTCLOUD_SECRET_KEY`**（README 原文，带下划线），
> 而 **CloudBase CLI 读的是 `TENCENTCLOUD_SECRETID` / `TENCENTCLOUD_SECRETKEY`**（源码 `ENV_NAME.ENV_SECRETID = 'TENCENTCLOUD_SECRETID'`，不带下划线）。两套都 export 最省事。

**写法 C：官方 Python SDK**（不想依赖 CLI 时）

```bash
pip install --user tencentcloud-sdk-python
python3 - <<'PY'
from tencentcloud.common import credential
from tencentcloud.ssl.v20191205 import ssl_client, models
cred = credential.Credential(__import__("os").environ["TENCENTCLOUD_SECRET_ID"],
                             __import__("os").environ["TENCENTCLOUD_SECRET_KEY"])
client = ssl_client.SslClient(cred, "")
req = models.UploadCertificateRequest()
req.CertificatePublicKey = open("/etc/ssl/gitalk.xsin.work/fullchain.pem").read()
req.CertificatePrivateKey = open("/etc/ssl/gitalk.xsin.work/privkey.pem").read()
req.CertificateType = "SVR"
req.Repeatable = False
req.Alias = "LE-gitalk.xsin.work"
print(client.UploadCertificate(req).to_json_string())   # -> {"CertificateId": "..."}
PY
```

### 3.4 返回的证书 ID 字段名

**`CertificateId`。**（`DescribeCertificates` 里对应字段叫 `CertificateId`，CloudBase 侧叫 `CertId`，`tcb --certid` 参数名是小写 `certid`，三处写法不同，别混。）

清理旧证书用 **`DeleteCertificate`**（参数 `CertificateId`，可选 `IsCheckResource`）。

### 3.5 需要的 CAM 权限

✅ **已验证**，来自腾讯云官方仓库 [TencentCloudBase/CloudBase-AI-Toolkit](https://github.com/TencentCloudBase/CloudBase-AI-Toolkit) 的
[`cloud-api-operations/references/calling-methods.md`](https://github.com/TencentCloudBase/CloudBase-AI-Toolkit/blob/main/config/source/skills/cloud-api-operations/references/calling-methods.md) §3.3：

| 需要的能力 | 预设策略 |
|---|---|
| SSL 证书的**写**（申请 / 续期 / 删除 / 部署到 CDN） | **`QcloudSSLFullAccess`** |
| 只读证书（`ssl:DescribeCertificates` / `DescribeCertificateDetail` / `CheckCertificateChain`） | `QcloudSSLReadOnlyAccess` |
| 云开发自己的域名（静态托管 / 网关自定义域名的绑定解绑） | **不需要额外策略** —— 走 `tcb:*` 与 `cdn:Tcb*` 系列 Action |

最小权限的自定义策略（把动作收敛到本次需要的三个）：

```json
{
  "version": "2.0",
  "statement": [
    {
      "effect": "allow",
      "action": [
        "ssl:UploadCertificate",
        "ssl:DescribeCertificates",
        "ssl:DeleteCertificate"
      ],
      "resource": ["*"]
    }
  ]
}
```

> 同一份文档还给出了一个**非常重要的判断路径**（§3.1）：调不通先看凭据身份。
> - **环境级 API Key**（`tcb login --cloudbase-api-key`）走服务端固定模型，**没有为单个 Key 追加任意 CAM 策略的通道** → 这种身份大概率传不了证书。
> - 用**腾讯云 API 密钥登录**（`tcb login --apiKeyId/--apiKey`）时，落在子账号自身的 CAM 策略上 → 给这个子账号挂 `QcloudSSLFullAccess` 即可（或上面的最小自定义策略）。

---

## 4. 上传后如何让 CloudBase 用上新证书（对应问题 4）

### 4.1 用 `edit`，不是 `add`

✅ **已验证**（官方文档 + CLI 源码）：

- `tcb domains add <domain> --certid <certId> -e <envId>` —— **首次绑定**用。
- **`tcb domains edit <domain> --certid <certId> -e <envId>`** —— **换证书**用。
  官方文档 <https://docs.cloudbase.net/cli-v1/domains> 原文：「更新自定义域名配置（域名级字段）… **仅更新显式传入字段**，不修改路由配置」，`--certid` 说明是「要更新的 SSL 证书 ID」。

CLI 源码（`dist/standalone/cli.js`，`EditDomainsCommand`）行为：先 `getHTTPServiceRoutes` 按 `Domain` 过滤确认域名存在，
把显式传入的字段拼成 `updatePayload = {Domain, CertId, AccessType, CustomCname, Enable}`，最后调 `modifyHttpServiceRoute`。
底层 API 动作是 **`ModifyHTTPServiceRoute`**（`packages/proxy-cloudbase/node_modules/@cloudbase/cli` 内 `envService.modifyHttpServiceRoute` → `cloudService.request('ModifyHTTPServiceRoute', …)`）。

```bash
tcb domains edit gitalk.xsin.work --certid "$NEW_CERT_ID" -e "$CLOUDBASE_ENV_ID" --json -y
```

> 对已绑定的域名再跑 `domains add` 会撞 `RESOURCE_ALREADY_EXISTS`（源码里有对这个 code 的幂等处理，但语义上就该用 `edit`）。
> 需要 `--dry-run` 可以先预览。

### 4.2 证书到期换新后，已绑定域名会不会自动用新证书？

**不会。（✅ 源码验证）**

- CloudBase 存的是**证书 ID 指针**，不是证书内容。官方 Manager Node SDK 文档里 `HTTPServiceDomain` 结构体明确有 `CertId` 字段（说明「SSL 证书 ID」）；`bindCustomDomain` 的 `CertId` 是**必填**且注明「腾讯云 SSL 平台」。
- CLI 里做幂等/更新判断的逻辑就是**比较 CertId 是否相等**（源码 `tcb deploy` 路径）：
  ```js
  // 3. 已绑定且无需更新证书（未显式配置 certId，或与云端证书一致）→ 跳过绑定
  if (bound && (!certId || (bound.CertId && bound.CertId === certId))) return;
  // 4. 执行绑定：未绑定 = 首次绑定；已绑定但更换了 certId = 更新证书
  ```
- Let's Encrypt 每次续期都会生成**新的证书内容**（新序列号）→ 上传腾讯云得到**新的 `CertificateId`** → 与域名上记录的旧 ID **必然不等** → **必须显式重绑**。

所以「上传新证书」这一步之后，必须跟一条 `tcb domains edit … --certid <新ID>`。这正是 §9 脚本在做的事。

> 补充：`tcb deploy`（声明式部署）在 `cloudbaserc.json` 的 `gateway.routes[].certId` 里显式写了证书 ID 时，
> 也会发现 `bound.CertId !== certId` 并自动重绑（源码注释原文：「已绑定但更换了 certId 更新证书」）。
> 也就是说还有**第二条自动化路线**：把 certId 写进配置、上传后调一次 `tcb deploy`。但 CLI 文档里 `gateway` 段没有展开，
> 我没验证过它的完整 schema，⚠️ 未验证 —— 稳妥起见本方案用直白的 `domains edit`。

### 4.3 顺带确认：cron 里跑 CLI 不会卡在交互提示

✅ **已验证**（源码 `interactive.isYesMode` / `autoConfirm` / `canPrompt`）：

```js
function isYesMode() {
  return process.argv.includes('-y') || process.argv.includes('--yes')
      || process.env.CLOUDBASE_CI === '1';
}
function canPrompt() { if (isYesMode()) return false; if (isJsonOutput()) return false; ... }
function autoConfirm(message, defaultValue = true) {
  if (isYesMode()) return defaultValue;      // 直接返回默认值，不提问
  ...
}
```

→ **cron 里所有 `tcb` 命令都带 `-y`，或者 `export CLOUDBASE_CI=1`**，否则无 TTY 时交互提示会失败/挂住。
`tcb domains add` 在未指定 `--certid` 且匹配到多张证书时会弹选择列表（源码 `selectCertificateByDomain` → `inquirer.prompt`），
**所以脚本里永远显式传 `--certid`。**

---

## 5. 现成的「一站式」开源项目（对应问题 5）

| 项目 | ★ | 最近提交 | 能力 | 是否推荐 |
|---|---|---|---|---|
| [certimate-go/certimate](https://github.com/certimate-go/certimate) | 9,370 | 2026-10-16 | 自托管工作流：70+ DNS 厂商（含阿里云 DNS）+ 160+ 部署目标（含腾讯云 SSL） | **推荐作为「不想自己写脚本」的备选** |
| [certd/certd](https://github.com/certd/certd) | 5,066 | 2026-10-16 | 开源证书管理，申请/续期/部署到阿里云、腾讯云、主机、群晖、宝塔 | 可选，AGPL-3.0 |
| [allinssl/allinssl](https://github.com/allinssl/allinssl) | 3,616 | 2026-10-16 | 证书全生命周期管理（申请/部署/监控） | 可选 |
| [renbaoshuo/deploy-certificate-to-tencentcloud](https://github.com/renbaoshuo/deploy-certificate-to-tencentcloud) | 10 | 2026-06-20 | GitHub Action，把 PEM 部署到腾讯云 CDN，README 明确要求 `QcloudCDNFullAccess` + `QcloudSSLFullAccess` | 只覆盖 CDN，**不覆盖 CloudBase 域名**，参考价值 > 使用价值 |

**Certimate 具体验证结果（✅ 已读源码树）：**

- 阿里云 DNS-01 验证器存在：`internal/certacme/certifiers/sp_aliyun_dns.go`（`ACMEDns01ProviderTypeAliyunDNS`，凭据 `AccessKeyId` / `AccessKeySecret`）。
- 腾讯云 SSL 部署器存在，且**确认调用 `UploadCertificate`**：
  ```
  pkg/core/certmgr/providers/tencentcloud-ssl/tencentcloud_ssl.go:
    uploadCertificateReq.CertificatePublicKey = common.StringPtr(certPEM)
    uploadCertificateReq.CertificatePrivateKey = common.StringPtr(privkeyPEM)
    uploadCertificateReq.Repeatable = common.BoolPtr(false)
    ... ssl.UploadCertificate ... CertId: *uploadCertificateResp.Response.CertificateId
  ```
- **但它没有 CloudBase 部署器。** 我在整棵树里搜 `cloudbase` / `tcb`，**0 命中**。
  它的腾讯云部署目标只有 `tencentcloud-ssl`、`tencentcloud-cdn`、`tencentcloud-eo`、`tencentcloud-clb`、`tencentcloud-cos`、`tencentcloud-scf`、`tencentcloud-waf` 等。
  → **最后一步「把 certId 绑到 CloudBase 域名」仍然要你自己做**（`tcb domains edit`）。

**结论：** 一站式项目能帮你省掉「签发 + 传到腾讯云 SSL」，但**省不掉 CloudBase 那一步**。
既然省不掉、而 acme.sh + 一个 60 行的钩子脚本就能全覆盖，**我建议直接用 acme.sh 方案**；Certimate 适合你想给非技术同事一个 Web UI 的场景。

---

## 6. 凭据与权限清单

### 6.1 阿里云（DNS-01 验证用）

| 项 | 值 |
|---|---|
| 凭据类型 | RAM 用户的 **AccessKeyId / AccessKeySecret** |
| acme.sh 变量名 | `Ali_Key` / `Ali_Secret` |
| 需要的最小 API 权限 | `alidns:DescribeDomainRecords`、`alidns:AddDomainRecord`、`alidns:DeleteDomainRecord`（✅ 从 `dns_ali.sh` 源码里的 `Action=` 反推） |
| 现成策略 | `AliyunDNSFullAccess`（阿里云预置策略，常用于该场景；见 [aliyun/alibabacloud-landing-zone](https://github.com/aliyun/alibabacloud-landing-zone) 等官方仓库引用） |
| 授权范围 | 建议只授权 `xsin.work` 这个域名资源，别给账号级 `*` |
| 创建入口 | <https://ram.console.aliyun.com/users> |

### 6.2 腾讯云（上传证书 + 绑域名）

| 项 | 值 |
|---|---|
| 凭据类型 | 腾讯云 API 密钥 **SecretId / SecretKey**（**必须用子账号，不要主账号**） |
| tcb CLI 登录 | `tcb login --apiKeyId <SecretId> --apiKey <SecretKey> -y` |
| tccli 变量名 | `TENCENTCLOUD_SECRET_ID` / `TENCENTCLOUD_SECRET_KEY` / `TENCENTCLOUD_REGION` |
| CloudBase CLI 变量名 | `TENCENTCLOUD_SECRETID` / `TENCENTCLOUD_SECRETKEY` / `TENCENTCLOUD_SESSIONTOKEN`（**无下划线**，源码实测） |
| SSL 写权限 | 预设策略 **`QcloudSSLFullAccess`**（或自定义策略只给 `ssl:UploadCertificate` / `ssl:DescribeCertificates` / `ssl:DeleteCertificate`） |
| CloudBase 域名权限 | **无需额外策略** —— 走 `tcb:*` / `cdn:Tcb*`；给子账号 `QcloudAccessForTCBRole`（官方 install 文档推荐的云开发预设策略） |
| 环境 ID | `CLOUDBASE_ENV_ID`，如 `env-xxxx`（`cloudbaserc.json` 里已在用 `{{env.CLOUDBASE_ENV_ID}}`） |

### 6.3 不需要的凭据

- ❌ 腾讯云 DNSPod / DNS 凭据 —— DNS 在阿里云，CloudBase 只让你配个 CNAME，验证挑战完全走阿里云。
- ❌ 证书私钥上传到第三方 SaaS —— 本方案私钥只在你的签发机器和腾讯云 SSL 之间流转。

---

## 7. 已知障碍与风险（哪些路走不通，直说）

1. **ICP 备案是硬门槛。** `tcb domains add` 帮助文本原话：「**需要域名已完成 ICP 备案**，并提供有效的 SSL 证书」；
   官方文档《自定义域名》也把「域名备案」列为前置准备。备案主体要挂在腾讯云侧的云资源上（官方提示「也可直接使用云开发环境完成备案」）。
   **这不是自动化能解决的问题** —— 没备案，后面所有命令都白搭。先确认 `xsin.work` 是否已在腾讯云完成备案。
   （例外：如果 CloudBase 环境在境外地域，可能不需要备案，但 CLI 的这条前置校验是否放开，⚠️ 未验证。）

2. **续期不会自动生效到 CloudBase。** 见 §4.2，必须显式重绑。这条路「走不通」的是「什么都不做就能续上」这个幻想。

3. **acme.sh 官方没有腾讯云 deploy hook**（63 个 deploy 脚本里 0 个腾讯云）。必须自己写 `--reloadcmd`。

4. **acme.sh 默认 CA 是 ZeroSSL，不是 Let's Encrypt。** 忘了 `--server letsencrypt` 就得不到 LE 证书。

5. **tccli 单参数不支持 `file://`。** 必须走 `--cli-input-json file://` 或 `$(cat …)`。别照抄网上「`--CertificatePublicKey file://xxx`」的写法。

6. **ECC 私钥能否上传腾讯云 SSL：⚠️ 未验证。** `UploadCertificate` 文档示例只出现 RSA 私钥，我没找到明确承诺。
   所以默认用 `--keylength 2048`。

7. **环境级 API Key 大概率不够权限。** `tcb login --cloudbase-api-key` 用的是服务端固定模型，官方文档明确说「没有为单个 Key 追加任意 CAM 策略的通道」。
   要调 `ssl.UploadCertificate`，用 `--apiKeyId/--apiKey`（子账号密钥）或设备码登录主账号。

8. **证书会越积越多。** 每次续期都上传一张新证书，`DescribeCertificates` 里同名域名会有一串。
   脚本里显式传 `--certid` 就绕开交互选择；想清理就调 `DeleteCertificate`（注意 CloudBase 域名上正在用的那张别删）。
   `UploadCertificate` 也有频率限制：**默认 10 次/秒**（文档原文），续期场景完全够。

9. **域名归属权校验。** 官方文档说「独立接入域名时，需要通过域名归属权校验」，方式是在 DNS 服务商加一条 **TXT** 记录（首次开边缘加速还要额外再验一次）。
   CLI 的 `domains add` 会不会自动触发这一步、TXT 值怎么取，⚠️ 我没在 CLI 源码里找到明确对应逻辑，**首次绑定请留出在控制台补 TXT 的可能**。

10. **DNS 在阿里云这件事本身没有任何障碍。** CloudBase 只要求你在阿里云加一条 **CNAME**（绑定成功后在控制台/`tcb domains ls` 里拿到值）；
    ACME 的 `_acme-challenge.gitalk.xsin.work` TXT 记录也加在阿里云，由 `dns_ali` 插件自动增删。两个流程互不干扰。

---

## 8. 落地步骤

### 8.1 一次性前置

```bash
# 0) 确认 ICP 备案已完成（腾讯云控制台 → 备案管理）
# 1) 阿里云 RAM 建子用户 → 拿 AccessKey → 授权 AliyunDNSFullAccess（或最小自定义策略）
# 2) 腾讯云建子账号 → 拿 SecretId/SecretKey → 挂 QcloudSSLFullAccess + QcloudAccessForTCBRole
# 3) 确认 CloudBase 环境 ID
export CLOUDBASE_ENV_ID="env-xxxx"
```

### 8.2 安装 acme.sh 并签发

```bash
curl https://get.acme.sh | sh -s email=you@example.com

export Ali_Key="<RAM AccessKeyId>"
export Ali_Secret="<RAM AccessKeySecret>"

~/.acme.sh/acme.sh --issue \
  --server letsencrypt \
  -d gitalk.xsin.work \
  --dns dns_ali \
  --keylength 2048
```

### 8.3 装证书到稳定路径 + 挂钩子

```bash
sudo install -d -m 0755 /etc/ssl/gitalk.xsin.work
sudo install -d -m 0755 /var/lib/cloudbase-cert

sudo ~/.acme.sh/acme.sh --install-cert -d gitalk.xsin.work \
  --key-file       /etc/ssl/gitalk.xsin.work/privkey.pem \
  --fullchain-file /etc/ssl/gitalk.xsin.work/fullchain.pem \
  --reloadcmd      "/opt/gitalk/deploy-cert-to-cloudbase.sh >>/var/log/gitalk-cert.log 2>&1"
```

> `--install-cert` 会立刻执行一次 `--reloadcmd`，所以这一步就会完成「上传 + 绑定」。

### 8.4 首次绑定域名

```bash
tcb login --apiKeyId "$TCB_SECRET_ID" --apiKey "$TCB_SECRET_KEY" -y
tcb domains add gitalk.xsin.work --certid "$CERT_ID" -e "$CLOUDBASE_ENV_ID" -y
tcb domains ls -e "$CLOUDBASE_ENV_ID" --filter "Domain=gitalk.xsin.work" --json -y
# 取 CNAME 值 → 去阿里云 DNS 加 CNAME 记录
```

> 已绑过的域名不要重复 `add`，直接用脚本里的 `edit`。

### 8.5 续期验证（重要，别等 60 天后才发现坏了）

```bash
# 强制续期一次，看钩子是否被触发
~/.acme.sh/acme.sh --renew -d gitalk.xsin.work --force

# 看日志
tail -n 50 /var/log/gitalk-cert.log

# 确认 CloudBase 上 CertId 已变
tcb domains ls -e "$CLOUDBASE_ENV_ID" --filter "Domain=gitalk.xsin.work" --json -y
```

如果机器上没有 crontab（容器/精简系统），用 systemd timer 代替：

```ini
# /etc/systemd/system/acme-renew.service
[Unit]
Description=acme.sh renew
[Service]
Type=oneshot
ExecStart=/root/.acme.sh/acme.sh --cron --home /root/.acme.sh
```
```ini
# /etc/systemd/system/acme-renew.timer
[Unit]
Description=Daily acme.sh renew check
[Timer]
OnCalendar=*-*-* 03:17:00
Persistent=true
[Install]
WantedBy=timers.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now acme-renew.timer
```

---

## 9. 脚本

本目录下两个可直接用的脚本：

| 文件 | 作用 |
|---|---|
| [`deploy-cert-to-cloudbase.sh`](./deploy-cert-to-cloudbase.sh) | **核心钩子**：上传证书到腾讯云 SSL → 拿 CertificateId → `tcb domains edit` 重绑 → 校验。幂等，可手工重跑。 |
| [`issue-and-install-gitalk.sh`](./issue-and-install-gitalk.sh) | 一次性：检查前置 → 签发 → `--install-cert`（自动挂上上面那个钩子）→ 首次绑定。 |

两者都只用 `bash` + `node`（仓库已有 Node ≥20）+ `tcb`，不依赖 `jq`。

### 9.1 脚本验证到什么程度

- ✅ `bash -n` 语法检查通过。
- ✅ **用一个假的 `tcb` 可执行文件做了端到端跑通**（不触网、不用真凭据）：
  上传 → 解析 `CertificateId` → `domains edit` → 回读校验，全流程 exit 0；
  二次执行命中幂等分支（"云端已绑定该证书，无需操作"）；
  证书/私钥不匹配时按预期 exit 1 并给出 `FailedOperation.CertificateMatchError` 的提示。
- ✅ JSON 解析助手对以下四种真实响应形态都验证过：
  `{"data":{"Domains":[…]}}`、`{"Domains":[…]}`、`{"data":{"CertificateId":…}}`、`{"Response":{"CertificateId":…}}`。
- ❌ **没有**对真实腾讯云接口发过请求（本机无凭据，也不该有）。
  真实环境的第一次执行请当作「首次运行验证」，重点看：
  `tcb api ssl UploadCertificate` 是否被 `api_blacklist` 拦截（我读过该模块，只拦 DB 账号密码类操作，不含 ssl）、
  以及 `tcb domains ls --json` 的实际字段名（脚本用的是递归找 `Domain` → `CertId`，对形状不敏感，但值得肉眼确认一次）。

---

## 10. 证据来源（全部一手）

**工具**
- acme.sh 仓库与 README：<https://github.com/acmesh-official/acme.sh> ｜ <https://github.com/acmesh-official/acme.sh/blob/master/README.md>
- acme.sh 阿里云插件源码：<https://github.com/acmesh-official/acme.sh/blob/master/dnsapi/dns_ali.sh>
- acme.sh dnsapi wiki（`Ali_Key`/`Ali_Secret`）：<https://github.com/acmesh-official/acme.sh/wiki/dnsapi>
- lego 阿里云文档：<https://go-acme.github.io/lego/dns/alidns/>
- certbot 仓库（顶层 `certbot-dns-*` 目录列表）：<https://github.com/certbot/certbot>
- caddy-dns/alidns：<https://github.com/caddy-dns/alidns>

**腾讯云**
- `UploadCertificate` API：<https://cloud.tencent.com/document/api/400/41665>
- SSL Python SDK schema：<https://github.com/TencentCloud/tencentcloud-sdk-python/blob/master/tencentcloud/ssl/v20191205/models.py>
- tccli 安装与配置：<https://github.com/TencentCloud/tencentcloud-cli#readme> ｜ <https://cloud.tencent.com/document/product/440/34011>
- tccli 官方调用示例：<https://github.com/TencentCloud/tencentcloud-cli/blob/master/tccli/examples/ssl/v20191205/UploadCertificate.md>
- **CAM 策略名与凭据身份**：<https://github.com/TencentCloudBase/CloudBase-AI-Toolkit/blob/main/config/source/skills/cloud-api-operations/references/calling-methods.md>

**CloudBase**
- CLI `domains` 命令文档：<https://docs.cloudbase.net/cli-v1/domains>
- CLI 通用云 API 调用（`tcb api`）：<https://docs.cloudbase.net/cli-v1/api>
- CLI 安装与登录：<https://docs.cloudbase.net/cli-v1/install>
- 自定义域名（ICP/SSL/归属权校验）：<https://docs.cloudbase.net/service/custom-domain>
- Manager Node SDK 自定义域名（`bindCustomDomain` / `HTTPServiceDomain.CertId` / `modifyHttpServiceRoute`）：<https://docs.cloudbase.net/api-reference/manager/node/domain>
- CLI 实现（`EditDomainsCommand`、`AddDomainsCommand`、`ApiCallCommand`、`ServiceVersionMap`、`isYesMode`）：`@cloudbase/cli@3.8.7` 的 `dist/standalone/cli.js`（本仓库 `packages/proxy-cloudbase/node_modules/@cloudbase/cli`）

**一站式项目**
- Certimate：<https://github.com/certimate-go/certimate> ｜ <https://docs.certimate.me>
- certd：<https://github.com/certd/certd>
- AllinSSL：<https://github.com/allinssl/allinssl>
