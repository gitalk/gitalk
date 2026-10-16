#!/usr/bin/env bash
#
# issue-and-install-gitalk.sh
#
# 一次性执行：用 acme.sh + 阿里云 DNS-01 签发 gitalk.xsin.work 的 Let's Encrypt 证书，
# 复制到稳定路径，并把「上传腾讯云 SSL + 重绑 CloudBase 域名」挂成 --reloadcmd。
#
# 之后每次续期（cron 每天 4 次触发 acme.sh --cron）都会自动重放这个钩子。
#
# 用法：
#   export Ali_Key="<阿里云 RAM AccessKeyId>"
#   export Ali_Secret="<阿里云 RAM AccessKeySecret>"
#   export CLOUDBASE_ENV_ID="env-xxxx"
#   export TCB_SECRET_ID="AKID..."      # 腾讯云子账号
#   export TCB_SECRET_KEY="..."
#   bash docs/cert-automation/issue-and-install-gitalk.sh
#
set -euo pipefail

CERT_DOMAIN="${CERT_DOMAIN:-gitalk.xsin.work}"
ACME_SERVER="${ACME_SERVER:-letsencrypt}"     # 必须显式指定：acme.sh 默认 CA 是 ZeroSSL
KEY_LENGTH="${KEY_LENGTH:-2048}"              # RSA 2048；首次落地不要用默认的 ec-256，见 README §2.3

ACME_HOME="${ACME_HOME:-$HOME/.acme.sh}"
ACME="${ACME:-$ACME_HOME/acme.sh}"

SSL_DIR="${SSL_DIR:-/etc/ssl/${CERT_DOMAIN}}"
CERT_FULLCHAIN="$SSL_DIR/fullchain.pem"
CERT_PRIVKEY="$SSL_DIR/privkey.pem"

# 钩子脚本默认取本脚本同目录下的 deploy-cert-to-cloudbase.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="${HOOK:-$SCRIPT_DIR/deploy-cert-to-cloudbase.sh}"
LOG_FILE="${LOG_FILE:-/var/log/gitalk-cert.log}"

log() { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 前置检查
# ---------------------------------------------------------------------------
[ -n "${Ali_Key:-}" ]    || die "缺少 Ali_Key（阿里云 RAM AccessKeyId）"
[ -n "${Ali_Secret:-}" ] || die "缺少 Ali_Secret（阿里云 RAM AccessKeySecret）"
[ -n "${CLOUDBASE_ENV_ID:-}" ] || die "缺少 CLOUDBASE_ENV_ID"
[ -x "$HOOK" ] || die "钩子脚本不存在或不可执行：$HOOK"

if [ ! -x "$ACME" ]; then
  log "未找到 $ACME，开始安装 acme.sh"
  curl -sS https://get.acme.sh | sh -s email="${ACME_EMAIL:-admin@${CERT_DOMAIN#*.}}"
  [ -x "$ACME" ] || die "acme.sh 安装后仍找不到：$ACME"
fi
log "acme.sh = $ACME"

mkdir -p "$SSL_DIR"
chmod 750 "$SSL_DIR" || true

# ---------------------------------------------------------------------------
# 1. 签发（DNS-01 / 阿里云）
# ---------------------------------------------------------------------------
log "签发证书：$CERT_DOMAIN（CA=$ACME_SERVER, keylength=$KEY_LENGTH）"
"$ACME" --issue \
  --server "$ACME_SERVER" \
  -d "$CERT_DOMAIN" \
  --dns dns_ali \
  --keylength "$KEY_LENGTH"

# ---------------------------------------------------------------------------
# 2. 复制到稳定路径 + 挂钩子
#    注意：--install-cert 会【立刻执行一次】--reloadcmd，
#    所以这一步同时完成「上传腾讯云 SSL + 重绑 CloudBase 域名」。
#    （源码 _installcert()：先复制证书文件，之后才 eval 钩子。）
# ---------------------------------------------------------------------------
log "安装证书到 $SSL_DIR 并注册 --reloadcmd"
"$ACME" --install-cert -d "$CERT_DOMAIN" \
  --key-file       "$CERT_PRIVKEY" \
  --fullchain-file "$CERT_FULLCHAIN" \
  --reloadcmd      "$HOOK >>$LOG_FILE 2>&1"

# ---------------------------------------------------------------------------
# 3. 结果提示
# ---------------------------------------------------------------------------
log "完成。证书文件："
log "  fullchain = $CERT_FULLCHAIN"
log "  privkey   = $CERT_PRIVKEY"
log "钩子日志：$LOG_FILE"

cat <<EOF

-------------------------------- 接下来 ---------------------------------
1) 确认钩子跑通了：
     tail -n 50 $LOG_FILE

2) 拷出刚上传得到的 CertificateId（钩子日志里有一行 "腾讯云 SSL CertificateId = ..."）。
   如果这是【首次】绑定该域名，执行一次 add：
     tcb login --apiKeyId "\$TCB_SECRET_ID" --apiKey "\$TCB_SECRET_KEY" -y
     tcb domains add $CERT_DOMAIN --certid <CertificateId> -e $CLOUDBASE_ENV_ID -y

   如果域名已经绑定过，钩子里的 domains edit 已经改好了，不需要做任何事。

3) 去阿里云 DNS 给 $CERT_DOMAIN 加 CNAME 记录，
   值从下面这条命令的输出里取：
     tcb domains ls -e $CLOUDBASE_ENV_ID --filter "Domain=$CERT_DOMAIN" --json -y

4) 演练一次续期，别等 60 天后才发现钩子坏了：
     $ACME --renew -d $CERT_DOMAIN --force
     tail -n 50 $LOG_FILE
-------------------------------------------------------------------------

EOF
