#!/usr/bin/env bash
#
# deploy-cert-to-cloudbase.sh
#
# 把最新签发的证书上传到【腾讯云 SSL 证书】，再把 CloudBase HTTP 网关的自定义域名
# 重新指向新证书（tcb domains edit --certid）。
#
# 设计为 acme.sh 的 --reloadcmd 钩子：
#   acme.sh --install-cert -d gitalk.xsin.work \
#     --fullchain-file /etc/ssl/gitalk.xsin.work/fullchain.pem \
#     --key-file       /etc/ssl/gitalk.xsin.work/privkey.pem \
#     --reloadcmd      "/opt/gitalk/deploy-cert-to-cloudbase.sh >>/var/log/gitalk-cert.log 2>&1"
#
# 也可以在证书换新后手工执行 —— 脚本是幂等的：如果云端已经绑定的是同一张证书，就跳过重绑。
#
# 依赖：bash + node（>=18，仓库已要求 >=20）+ @cloudbase/cli（tcb）
#      刻意不依赖 jq / tccli / python。
#
set -euo pipefail

# ---------------------------------------------------------------------------
# 配置（都可用环境变量覆盖）
# ---------------------------------------------------------------------------
CERT_DOMAIN="${CERT_DOMAIN:-gitalk.xsin.work}"

# 证书文件：优先用 --install-cert 复制出来的稳定路径；
# 找不到时回退到 acme.sh 在 reloadcmd 环境里 export 的 CERT_FULLCHAIN_PATH / CERT_KEY_PATH。
CERT_FULLCHAIN="${CERT_FULLCHAIN:-/etc/ssl/${CERT_DOMAIN}/fullchain.pem}"
CERT_PRIVKEY="${CERT_PRIVKEY:-/etc/ssl/${CERT_DOMAIN}/privkey.pem}"

# 腾讯云 / CloudBase
CLOUDBASE_ENV_ID="${CLOUDBASE_ENV_ID:-}"
TCB_SECRET_ID="${TCB_SECRET_ID:-}"
TCB_SECRET_KEY="${TCB_SECRET_KEY:-}"

# 证书在腾讯云 SSL 控制台里显示的名字。带时间戳，方便区分是哪一次续期。
CERT_ALIAS="${CERT_ALIAS:-LE-${CERT_DOMAIN}-$(date -u +%Y%m%dT%H%M%SZ)}"

# 记录上一次的 CertificateId，用于识别「内容没变」和清理旧证书
STATE_DIR="${STATE_DIR:-/var/lib/cloudbase-cert}"

# 是否删除上一张证书（1=删，0=保留）。默认保留：域名上正在用的那张千万别删。
# 注意 CloudBase 绑定的是 CertId，重绑瞬间旧证书就不再被引用，但为稳妥起见默认不动它。
DELETE_OLD_CERT="${DELETE_OLD_CERT:-0}"

# tcb 命令：不设置时按 REPO 本地 bin → PATH 顺序找
TCB_BIN="${TCB_BIN:-}"
NODE_BIN="${NODE_BIN:-}"

# 仓库内自带的 CLI（packages/proxy-cloudbase 把它钉成了 devDependency）
REPO_ROOT_DEFAULT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REPO_ROOT="${REPO_ROOT:-$REPO_ROOT_DEFAULT}"

# ---------------------------------------------------------------------------
# 小工具
# ---------------------------------------------------------------------------
log()  { printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die()  { printf '[%s] ERROR: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; exit 1; }

# cron 的 PATH 极简，nvm/homebrew 装的 node 常常找不到，所以显式解析绝对路径。
resolve_bin() {
  local explicit="$1" name="$2"; shift 2
  if [ -n "$explicit" ]; then
    [ -x "$explicit" ] || die "$name 指向的文件不可执行：$explicit"
    printf '%s' "$explicit"; return 0
  fi
  local cand
  for cand in "$@"; do
    if [ -n "$cand" ] && [ -x "$cand" ]; then printf '%s' "$cand"; return 0; fi
  done
  local found
  found="$(command -v "$name" 2>/dev/null || true)"
  [ -n "$found" ] && { printf '%s' "$found"; return 0; }
  return 1
}

# 从任意形状的 JSON 里找出目标域名的 CertId。
# 兼容 {data:{Domains:[...]}} / {Domains:[...]} / {data:{...}} / 直接数组 等所有形态，
# 做法是递归遍历，找到 .Domain === 目标域名的对象再取 .CertId。
json_find_certid() {
  local domain="$1"
  "$NODE_BIN" -e '
    const domain = process.argv[1];
    let raw = "";
    process.stdin.on("data", (d) => (raw += d));
    process.stdin.on("end", () => {
      let parsed;
      try { parsed = JSON.parse(raw); } catch (e) {
        process.stderr.write("无法解析 JSON：" + raw.slice(0, 500) + "\n");
        process.exit(3);
      }
      const seen = new Set();
      let hit = null;
      (function walk(node) {
        if (!node || typeof node !== "object" || seen.has(node)) return;
        seen.add(node);
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (node.Domain === domain && node.CertId) { hit = node.CertId; return; }
        for (const v of Object.values(node)) walk(v);
      })(parsed);
      if (hit) process.stdout.write(hit);
    });
  ' "$domain"
}

# 从 UploadCertificate 响应里取 CertificateId。
# tcb api --json 会把结果包一层 data（源码 outputJson: { data }）；tccli 是 {Response:{...}}。
json_find_certificate_id() {
  "$NODE_BIN" -e '
    let raw = "";
    process.stdin.on("data", (d) => (raw += d));
    process.stdin.on("end", () => {
      let parsed;
      try { parsed = JSON.parse(raw); } catch (e) {
        process.stderr.write("上传响应不是合法 JSON：\n" + raw.slice(0, 800) + "\n");
        process.exit(3);
      }
      const seen = new Set();
      let hit = null;
      (function walk(node) {
        if (!node || typeof node !== "object" || seen.has(node)) return;
        seen.add(node);
        if (Array.isArray(node)) { node.forEach(walk); return; }
        if (!hit && typeof node.CertificateId === "string" && node.CertificateId) hit = node.CertificateId;
        for (const v of Object.values(node)) walk(v);
      })(parsed);
      if (!hit) {
        process.stderr.write("响应里没有 CertificateId：\n" + raw.slice(0, 800) + "\n");
        process.exit(4);
      }
      process.stdout.write(hit);
    });
  '
}

# ---------------------------------------------------------------------------
# 0. 解析依赖
# ---------------------------------------------------------------------------
NODE_BIN="$(resolve_bin "$NODE_BIN" node \
  "$REPO_ROOT/node_modules/.bin/node" \
  /usr/local/bin/node /opt/homebrew/bin/node /usr/bin/node)" \
  || die "找不到 node。请在脚本里显式设置 NODE_BIN=/绝对路径/node"

TCB_BIN="$(resolve_bin "$TCB_BIN" tcb \
  "$REPO_ROOT/packages/proxy-cloudbase/node_modules/.bin/tcb" \
  "$REPO_ROOT/node_modules/.bin/tcb" \
  /usr/local/bin/tcb /opt/homebrew/bin/tcb /usr/bin/tcb)" \
  || die "找不到 tcb。请先 pnpm install，或设置 TCB_BIN=/绝对路径/tcb"

log "node  = $NODE_BIN"
log "tcb   = $TCB_BIN"
log "域名  = $CERT_DOMAIN"

# ---------------------------------------------------------------------------
# 1. 找证书文件
# ---------------------------------------------------------------------------
if [ ! -s "$CERT_FULLCHAIN" ] && [ -n "${CERT_FULLCHAIN_PATH:-}" ] && [ -s "${CERT_FULLCHAIN_PATH}" ]; then
  CERT_FULLCHAIN="$CERT_FULLCHAIN_PATH"
fi
if [ ! -s "$CERT_PRIVKEY" ] && [ -n "${CERT_KEY_PATH:-}" ] && [ -s "${CERT_KEY_PATH}" ]; then
  CERT_PRIVKEY="$CERT_KEY_PATH"
fi
[ -s "$CERT_FULLCHAIN" ] || die "找不到 fullchain：$CERT_FULLCHAIN"
[ -s "$CERT_PRIVKEY" ]   || die "找不到私钥：$CERT_PRIVKEY"
log "fullchain = $CERT_FULLCHAIN"
log "privkey   = $CERT_PRIVKEY"

# ---------------------------------------------------------------------------
# 2. 自检：证书和私钥是否配对、是否已过期
# ---------------------------------------------------------------------------
if command -v openssl >/dev/null 2>&1; then
  pub_from_cert="$(openssl x509 -in "$CERT_FULLCHAIN" -noout -pubkey 2>/dev/null || true)"
  pub_from_key="$(openssl pkey -in "$CERT_PRIVKEY" -pubout 2>/dev/null || true)"
  if [ -z "$pub_from_cert" ] || [ -z "$pub_from_key" ]; then
    log "WARN: openssl 无法解析证书/私钥，跳过配对校验"
  elif [ "$pub_from_cert" != "$pub_from_key" ]; then
    die "证书与私钥不匹配（腾讯云会报 FailedOperation.CertificateMatchError）"
  else
    log "证书 / 私钥配对校验通过"
  fi

  not_after="$(openssl x509 -in "$CERT_FULLCHAIN" -noout -enddate 2>/dev/null | cut -d= -f2 || true)"
  [ -n "$not_after" ] && log "证书到期时间：$not_after"
fi

[ -n "$CLOUDBASE_ENV_ID" ] || die "缺少 CLOUDBASE_ENV_ID"

# ---------------------------------------------------------------------------
# 3. 登录（可选；已有登录态时可省略 TCB_SECRET_ID/TCB_SECRET_KEY）
# ---------------------------------------------------------------------------
# CLOUDBASE_CI=1 让 CLI 的 autoConfirm() 直接返回默认值而不提问（源码 isYesMode()），
# cron 里没有 TTY，不设这个会卡在确认提示上。
export CLOUDBASE_CI=1

if [ -n "$TCB_SECRET_ID" ] && [ -n "$TCB_SECRET_KEY" ]; then
  log "使用腾讯云 API 密钥登录 CloudBase CLI（子账号）"
  "$TCB_BIN" login --apiKeyId "$TCB_SECRET_ID" --apiKey "$TCB_SECRET_KEY" -y >/dev/null
else
  log "未提供 TCB_SECRET_ID/TCB_SECRET_KEY，沿用已有登录态"
fi

# ---------------------------------------------------------------------------
# 4. 记录当前域名绑定的 CertId（用于幂等判断）
# ---------------------------------------------------------------------------
mkdir -p "$STATE_DIR"
LAST_CERT_FILE="$STATE_DIR/${CERT_DOMAIN}.last-cert-id"
BOUND_BEFORE=""
if ls_out="$("$TCB_BIN" domains ls -e "$CLOUDBASE_ENV_ID" --filter "Domain=${CERT_DOMAIN}" --json -y 2>/dev/null)"; then
  BOUND_BEFORE="$(printf '%s' "$ls_out" | json_find_certid "$CERT_DOMAIN" || true)"
fi
log "云端当前绑定的 CertId：${BOUND_BEFORE:-<无>}"

# ---------------------------------------------------------------------------
# 5. 上传证书到腾讯云 SSL  →  ssl.UploadCertificate
# ---------------------------------------------------------------------------
REQ_FILE="$(mktemp)"
trap 'rm -f "$REQ_FILE"' EXIT

CERT_FULLCHAIN="$CERT_FULLCHAIN" CERT_PRIVKEY="$CERT_PRIVKEY" \
CERT_ALIAS="$CERT_ALIAS" REQ_FILE="$REQ_FILE" "$NODE_BIN" -e '
  const fs = require("fs");
  const body = {
    CertificatePublicKey: fs.readFileSync(process.env.CERT_FULLCHAIN, "utf8"),
    CertificatePrivateKey: fs.readFileSync(process.env.CERT_PRIVKEY, "utf8"),
    CertificateType: "SVR",   // SVR = 服务器证书（CA 才不用传私钥）
    Repeatable: false,        // 同指纹不重复上传；命中已有证书时返回 RepeatCertId
    Alias: process.env.CERT_ALIAS
  };
  fs.writeFileSync(process.env.REQ_FILE, JSON.stringify(body));
'

log "上传证书到腾讯云 SSL（ssl.UploadCertificate）"
# 版本 2019-12-05：CLI 内置 ServiceVersionMap 里 ssl 已映射，无需 --api-version
UPLOAD_OUT="$("$TCB_BIN" api ssl UploadCertificate --body "$(cat "$REQ_FILE")" --json -y)"
NEW_CERT_ID="$(printf '%s' "$UPLOAD_OUT" | json_find_certificate_id)"
log "腾讯云 SSL CertificateId = $NEW_CERT_ID"

# ---------------------------------------------------------------------------
# 6. 幂等：已绑定同一张 → 直接结束
# ---------------------------------------------------------------------------
if [ "$NEW_CERT_ID" = "$BOUND_BEFORE" ]; then
  log "云端已绑定该证书，无需操作"
  printf '%s' "$NEW_CERT_ID" > "$LAST_CERT_FILE"
  exit 0
fi

# ---------------------------------------------------------------------------
# 7. 让 CloudBase 域名使用新证书  →  ModifyHTTPServiceRoute
# ---------------------------------------------------------------------------
log "重绑 CloudBase 域名 [${CERT_DOMAIN}] → CertId ${NEW_CERT_ID}"
"$TCB_BIN" domains edit "$CERT_DOMAIN" \
  --certid "$NEW_CERT_ID" \
  -e "$CLOUDBASE_ENV_ID" \
  --json -y >/dev/null

# ---------------------------------------------------------------------------
# 8. 校验
# ---------------------------------------------------------------------------
VERIFY_OUT="$("$TCB_BIN" domains ls -e "$CLOUDBASE_ENV_ID" --filter "Domain=${CERT_DOMAIN}" --json -y)"
BOUND_AFTER="$(printf '%s' "$VERIFY_OUT" | json_find_certid "$CERT_DOMAIN" || true)"
if [ "$BOUND_AFTER" != "$NEW_CERT_ID" ]; then
  die "重绑后校验失败：期望 CertId=${NEW_CERT_ID}，实际=${BOUND_AFTER:-<空>}"
fi
log "校验通过：${CERT_DOMAIN} 当前 CertId = ${BOUND_AFTER}"

# ---------------------------------------------------------------------------
# 9. 可选：删除上一张证书
# ---------------------------------------------------------------------------
OLD_CERT_ID=""
[ -f "$LAST_CERT_FILE" ] && OLD_CERT_ID="$(cat "$LAST_CERT_FILE")"
if [ "$DELETE_OLD_CERT" = "1" ] && [ -n "$OLD_CERT_ID" ] && [ "$OLD_CERT_ID" != "$NEW_CERT_ID" ]; then
  # IsCheckResource 保持默认 false：默认不检查云资源关联。
  # 注意：如果旧证书还被别的云资源（CDN/CLB/WAF）引用，这里会把它删掉。确认无引用再开。
  log "删除旧证书 $OLD_CERT_ID"
  if "$TCB_BIN" api ssl DeleteCertificate --body "{\"CertificateId\":\"$OLD_CERT_ID\"}" --json -y >/dev/null; then
    log "旧证书已删除"
  else
    log "WARN: 旧证书删除失败（不影响本次部署，可事后在控制台清理）"
  fi
fi

printf '%s' "$NEW_CERT_ID" > "$LAST_CERT_FILE"
log "完成。"
