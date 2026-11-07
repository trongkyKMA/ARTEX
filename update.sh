#!/usr/bin/env bash
# ARTEX 更新脚本：① Docker 更新（拉新镜像重建）  ② 本地编译更新（重建二进制）
# 与 install.sh 对应：install 负责首次落地，update 负责升级到新版本。
# DB 迁移无需手动执行——artex 每次启动都会幂等重跑 schema.sql（含 ADD COLUMN/CREATE
# INDEX IF NOT EXISTS），所以“重启即迁移”。数据（pgdata 卷、./data、./skills）不受影响。
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)"

info(){ printf '\033[36m[*]\033[0m %s\n' "$*"; }
ok(){   printf '\033[32m[+]\033[0m %s\n' "$*"; }
warn(){ printf '\033[33m[!]\033[0m %s\n' "$*"; }
die(){  printf '\033[31m[x]\033[0m %s\n' "$*" >&2; exit 1; }
ask(){  local p="$1" d="${2:-}" a; read -rp "$p${d:+ [$d]}: " a; echo "${a:-$d}"; }

# ── 可选：同步仓库到最新代码（compose/脚本/本地编译源码都靠它更新）───────
sync_repo(){
  [ -d .git ] && command -v git >/dev/null 2>&1 || { warn "Not a git working copy; skipping git pull"; return; }
  [ "$(ask 'Pull latest code (git pull --ff-only)? (y/n)' y)" = y ] || return
  if ! git pull --ff-only; then
    warn "git pull could not fast-forward (local changes or diverged branch); resolve manually and retry. Continuing with the current code"
  fi
}

# ── ① Docker 更新 ───────────────────────────────
update_docker(){
  command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 \
    || die "docker / docker compose not detected; deploy with ./install.sh first"
  [ -f .env ] || die "No .env found; run ./install.sh to complete the first deployment"

  # 可选：升级到指定版本 tag（不填则沿用 .env 中的 ARTEX_TAG，缺省为 latest）
  local tag; tag="$(ask 'Target image tag (press Enter to keep .env / latest)' '')"
  if [ -n "$tag" ]; then
    if grep -q '^ARTEX_TAG=' .env; then
      sed -i.bak "s|^ARTEX_TAG=.*|ARTEX_TAG=${tag}|" .env && rm -f .env.bak
    else
      printf '\nARTEX_TAG=%s\n' "$tag" >> .env
    fi
    ok "ARTEX_TAG set to ${tag}"
  fi

  # 只动 artex：postgres 是固定的 16-alpine，不需要跟着升级（拉它纯属浪费带宽，
  # 且大版本变动还会有兼容风险）。artex 声明了 depends_on postgres，所以带服务名
  # up 时若 pg 没起会自动拉起，已在跑的则原样保留、不重建。
  # This fork builds its image from source instead of pulling the upstream image.
  info "Rebuilding the ARTEX image from source (./docker-build.sh)…"
  ARTEX_TAG="${tag:-$(grep -E '^ARTEX_TAG=' .env | cut -d= -f2)}" ./docker-build.sh
  info "Recreating and starting (artex migrates the schema automatically on restart)…"
  docker compose up -d artex
  ok "Update complete -> http://localhost:8787"
  info "View logs: docker compose logs -f artex"
  info "Clean up old images (optional): docker image prune -f"
}

# ── ② 本地编译更新 ──────────────────────────────
update_local(){
  command -v go >/dev/null 2>&1 || die "Go (>=1.26) not detected: https://go.dev/dl/"
  [ -f config.json ] || warn "config.json not found; for a first deployment use ./install.sh instead"
  ok "Go: $(go version)"

  if command -v npm >/dev/null 2>&1; then
    info "Rebuilding frontend static assets…"
    ( cd web && npm ci && npm run build:static )
    rm -rf server/webui/dist && cp -r web/out server/webui/dist
    info "Recompiling embedded single binary…"
    CGO_ENABLED=0 go build -tags embedui -trimpath -o artex ./cmd/artex
  else
    warn "npm not detected: building the backend WITHOUT the embedded frontend (run npm run dev separately for the frontend)"
    CGO_ENABLED=0 go build -o artex ./cmd/artex
  fi
  ok "Build complete -> ./artex"
  warn "Restart the running artex process to apply (the schema is migrated automatically on restart)"
}

echo "=============================="
echo "  ARTEX Updater"
echo "  1) Docker update (pull new image and recreate)"
echo "  2) Local update (recompile with go)"
echo "=============================="
case "$(ask 'Choose' 1)" in
  1) sync_repo; update_docker ;;
  2) sync_repo; update_local ;;
  *) die "Invalid choice" ;;
esac
