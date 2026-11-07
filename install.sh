#!/usr/bin/env bash
# ARTEX 安装脚本：① 全部 Docker  ② 本地编译运行
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)"

info(){ printf '\033[36m[*]\033[0m %s\n' "$*"; }
ok(){   printf '\033[32m[+]\033[0m %s\n' "$*"; }
warn(){ printf '\033[33m[!]\033[0m %s\n' "$*"; }
die(){  printf '\033[31m[x]\033[0m %s\n' "$*" >&2; exit 1; }
ask(){  local p="$1" d="${2:-}" a; read -rp "$p${d:+ [$d]}: " a; echo "${a:-$d}"; }
rand(){ head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24; }

# ── docker 环境检测 / 自动安装 ───────────────────
ensure_docker(){
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    ok "Detected docker and docker compose"; return
  fi
  warn "docker / docker compose not detected"
  case "$(uname -s)" in
    Linux)
      if [ "$(ask 'Install Docker automatically? (y/n)' y)" = y ]; then
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker "$USER" || true
        ok "Docker installed (log out and back in for the group change to take effect without sudo)"
      else
        die "Please install docker yourself and retry"
      fi ;;
    Darwin) die "On macOS please install Docker Desktop: https://www.docker.com/products/docker-desktop/" ;;
    *)      die "Please install docker yourself and retry" ;;
  esac
}

# Run a command that talks to Docker. Right after Docker is installed, the user's
# new 'docker' group membership is not active in this shell yet: fall back to
# `sg docker` (no re-login needed), then to sudo.
dk(){
  if docker info >/dev/null 2>&1; then "$@"
  elif command -v sg >/dev/null 2>&1 && id -nG "$(id -un)" 2>/dev/null | grep -qw docker; then
    sg docker -c "$(printf '%q ' "$@")"
  else sudo "$@"; fi
}

env_get(){ grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2-; }
env_set(){
  if grep -qE "^$1=" .env; then sed -i.bak "s|^$1=.*|$1=$2|" .env && rm -f .env.bak
  else printf '%s=%s\n' "$1" "$2" >> .env; fi
}

# ── ① 全部 Docker ───────────────────────────────
install_docker(){
  ensure_docker
  if [ ! -f .env ]; then
    cp .env.example .env
    chmod 600 .env
    local pw
    pw="$(ask 'Postgres password (press Enter to generate a random one)' "$(rand)")"
    case "$pw" in *'|'*|*' '*) die "The password must not contain '|' or spaces" ;; esac
    env_set POSTGRES_PASSWORD "$pw"
    echo "Who may open the web UI (port $(env_get ARTEX_HTTP_PORT))?"
    echo "  1) Only this machine: 127.0.0.1 (recommended for a VPS / Internet-facing server;"
    echo "     open it through an SSH tunnel or an HTTPS reverse proxy)"
    echo "  2) Every interface: 0.0.0.0 (only on an internal network; Docker bypasses ufw)"
    case "$(ask 'Choose' 1)" in
      2) env_set ARTEX_BIND 0.0.0.0 ;;
      *) env_set ARTEX_BIND 127.0.0.1 ;;
    esac
    ok ".env generated (POSTGRES_PASSWORD, ARTEX_BIND=$(env_get ARTEX_BIND)); LLM keys are set later in the UI"
  else
    info "Reusing existing .env (ARTEX_BIND=$(env_get ARTEX_BIND))"
  fi
  # Build the ARTEX image from this source (prebuilt upstream images lack this
  # fork's changes; one of them was found backdoored). Needs only Docker: Go and
  # Node.js are used from the host when present, otherwise run in containers.
  info "Building the ARTEX image from source (./docker-build.sh)…"
  dk ./docker-build.sh
  info "Pulling PostgreSQL and starting…"
  dk docker compose pull postgres || true
  dk docker compose up -d
  local port bind tok="" i
  port="$(env_get ARTEX_HTTP_PORT)"; port="${port:-8787}"
  bind="$(env_get ARTEX_BIND)"; bind="${bind:-0.0.0.0}"
  info "Waiting for ARTEX to start…"
  for i in $(seq 1 60); do
    curl -fsS "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1 && break
    sleep 2
  done
  curl -fsS "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1 \
    || die "ARTEX did not answer on 127.0.0.1:${port}. Check: docker compose logs --tail 100 artex"
  # The token file is written before the server starts listening.
  tok="$(dk docker compose exec -T artex cat /app/keys/setup.token 2>/dev/null || true)"
  ok "ARTEX is running."
  if [ "$bind" = "127.0.0.1" ]; then
    echo "  Open it from your computer through an SSH tunnel:"
    echo "    ssh -N -L ${port}:127.0.0.1:${port} $(id -un)@<server-address>"
    echo "  then browse http://127.0.0.1:${port}/setup"
  else
    echo "  Browse http://<server-address>:${port}/setup"
  fi
  if [ -n "$tok" ]; then
    echo "  One-time setup token: ${tok}"
  else
    echo "  No setup token: the admin password is already set (fresh install? see: docker compose exec artex cat /app/keys/setup.token)"
  fi
  echo "  Log in afterwards as user ARTEX. Logs: docker compose logs -f artex"
  echo "  Deployment checklist: docs/DEPLOY-VPS.md"
}

# ── ② 本地编译运行 ──────────────────────────────
install_local(){
  echo "Database setup:"
  echo "  1) Connect to an existing PostgreSQL"
  echo "  2) Start a PostgreSQL with Docker (requires docker)"
  case "$(ask 'Choose' 1)" in
    2)
      ensure_docker
      local pw; pw="$(ask 'Postgres password (press Enter for random)' "$(rand)")"
      # Security: publish Postgres on loopback only (DB write access = command execution via mcp_servers).
      docker run -d --name artex-pg -p 127.0.0.1:5432:5432 \
        -e POSTGRES_USER=artex -e POSTGRES_PASSWORD="$pw" -e POSTGRES_DB=artex \
        -v artex-pg:/var/lib/postgresql/data postgres:16-alpine
      DB_HOST=127.0.0.1 DB_PORT=5432 DB_USER=artex DB_PASS="$pw" DB_NAME=artex DB_SSL=disable ;;
    *)
      DB_HOST="$(ask 'Database host' 127.0.0.1)"
      DB_PORT="$(ask 'Port' 5432)"
      DB_USER="$(ask 'User' artex)"
      DB_PASS="$(ask 'Password' '')"
      DB_NAME="$(ask 'Database name' artex)"
      DB_SSL="$(ask 'sslmode (disable/require)' disable)" ;;
  esac

  # 生成 config.json
  cat > config.json <<JSON
{
  "database": {
    "host": "${DB_HOST}",
    "port": ${DB_PORT},
    "user": "${DB_USER}",
    "password": "${DB_PASS}",
    "dbname": "${DB_NAME}",
    "sslmode": "${DB_SSL}"
  }
}
JSON
  chmod 600 config.json  # contains the DB password
  ok "config.json generated"

  # go 环境检查
  command -v go >/dev/null 2>&1 || die "Go not detected; please install Go (>=1.26) first: https://go.dev/dl/"
  ok "Go: $(go version)"

  # 内嵌前端需要 node 出静态产物
  if command -v npm >/dev/null 2>&1; then
    info "Building frontend static assets…"
    ( cd web && npm ci && npm run build:static )
    rm -rf server/webui/dist && cp -r web/out server/webui/dist
    info "Compiling embedded single binary…"
    CGO_ENABLED=0 go build -tags embedui -trimpath -o artex ./cmd/artex
  else
    warn "npm not detected: building the backend WITHOUT the embedded frontend (run npm run dev separately for the frontend)"
    CGO_ENABLED=0 go build -o artex ./cmd/artex
  fi
  ok "Build complete -> ./artex"

  info "Starting… (Ctrl-C to quit)"
  ./artex
}

echo "=============================="
echo "  ARTEX Installer"
echo "  1) Full Docker install"
echo "  2) Run locally (compile with go)"
echo "=============================="
case "$(ask 'Choose' 1)" in
  1) install_docker ;;
  2) install_local ;;
  *) die "Invalid choice" ;;
esac
