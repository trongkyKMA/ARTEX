#!/usr/bin/env bash
# Build the ARTEX Docker image from THIS source tree (English UI + security fixes +
# operator policy rules), instead of pulling a prebuilt upstream image.
#
#   ./docker-build.sh                 # image artex-local:latest for the host arch
#   ARTEX_IMAGE=myreg/artex ARTEX_TAG=v1 ./docker-build.sh
#   ARTEX_ARCH=arm64 ./docker-build.sh
#   ARTEX_BUILD_IN_DOCKER=1 ./docker-build.sh   # force the toolchain containers
#
# Steps: static-export the frontend -> embed it -> cross-compile a Linux binary into
# dist/<arch>/artex (the Dockerfile copies it from there) -> docker build.
#
# Only Docker is required. If Go and Node.js/npm are installed on the host they are
# used (faster on rebuilds); otherwise the frontend and the binary are built inside
# throwaway containers (ARTEX_NODE_IMAGE, ARTEX_GO_IMAGE), with npm and Go module
# caches kept in the Docker volumes artex-web-node-modules and artex-gomod.
#
# The binary is stamped with version "dev": with Docker the image is the source of
# truth, so the in-app one-click update (which swaps the binary inside the
# container) is disabled. Update by rebuilding (./update.sh) or with a release image.
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)"

info() { printf '\033[36m[*]\033[0m %s\n' "$*"; }
ok() { printf '\033[32m[+]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

IMAGE="${ARTEX_IMAGE:-artex-local}"
TAG="${ARTEX_TAG:-latest}"
ARCH="${ARTEX_ARCH:-}"
if [ -z "$ARCH" ]; then
  case "$(uname -m)" in
    x86_64|amd64) ARCH=amd64 ;;
    aarch64|arm64) ARCH=arm64 ;;
    *) die "Unknown host architecture $(uname -m); set ARTEX_ARCH=amd64|arm64" ;;
  esac
fi
NODE_IMAGE="${ARTEX_NODE_IMAGE:-node:22-bookworm}"
GO_IMAGE="${ARTEX_GO_IMAGE:-golang:1.27-bookworm}"
LDFLAGS="-s -w -X main.version=dev"

command -v docker >/dev/null 2>&1 || die "docker not found (https://docs.docker.com/engine/install/)"
docker info >/dev/null 2>&1 || die "Cannot talk to the Docker daemon. Is it running, and is this user in the 'docker' group (or run with sudo)?"

IN_DOCKER="${ARTEX_BUILD_IN_DOCKER:-}"
if [ -z "$IN_DOCKER" ]; then
  if command -v go >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then IN_DOCKER=0; else IN_DOCKER=1; fi
fi
# Files written by root inside the toolchain containers are handed back to the
# invoking user so the cleanup below (and later git operations) work without sudo.
OWNER="$(id -u):$(id -g)"
# Git Bash on Windows: stop MSYS from rewriting the container paths below.
export MSYS_NO_PATHCONV=1

if [ "$IN_DOCKER" = "1" ]; then
  info "Go/Node.js not used from the host: building inside ${NODE_IMAGE} and ${GO_IMAGE}"
fi

info "1/4 Building the frontend (static export)…"
if [ "$IN_DOCKER" = "1" ]; then
  # node_modules lives in a named volume: never mixed with a host install built for
  # another OS, and reused across builds. Reinstalled when empty or ARTEX_NPM_CI=1.
  docker run --rm \
    -v "$PWD/web:/web" -v artex-web-node-modules:/web/node_modules -w /web \
    -e NEXT_EXPORT=1 -e NEXT_TELEMETRY_DISABLED=1 -e NPM_CI="${ARTEX_NPM_CI:-0}" -e OWNER="$OWNER" \
    "$NODE_IMAGE" sh -ec '
      if [ ! -f node_modules/.package-lock.json ] || [ "$NPM_CI" = "1" ] || ! cmp -s package-lock.json node_modules/.artex-lock; then
        npm ci --no-audit --no-fund
        cp package-lock.json node_modules/.artex-lock
      fi
      npx --no-install next build
      find /web -path /web/node_modules -prune -o -user 0 -exec chown "$OWNER" {} + 2>/dev/null || true'
else
  # Install dependencies only on first build (or when ARTEX_NPM_CI=1, e.g. after a
  # package-lock.json change); reinstalling every time is slow.
  if [ ! -d web/node_modules ] || [ "${ARTEX_NPM_CI:-0}" = "1" ]; then
    (cd web && npm ci --no-audit --no-fund)
  fi
  # Same as `npm run build:static`, but sets NEXT_EXPORT in this shell so it also
  # works where npm runs scripts through cmd.exe (Windows / Git Bash).
  (cd web && NEXT_EXPORT=1 npx --no-install next build)
fi
[ -f web/out/index.html ] || die "Frontend export missing (web/out/index.html)"

info "2/4 Embedding the frontend…"
rm -rf server/webui/dist
mkdir -p server/webui
cp -r web/out server/webui/dist

info "3/4 Compiling linux/${ARCH} binary…"
mkdir -p "dist/${ARCH}"
if [ "$IN_DOCKER" = "1" ]; then
  docker run --rm \
    -v "$PWD:/src" -v artex-gomod:/go/pkg/mod -w /src \
    -e CGO_ENABLED=0 -e GOOS=linux -e GOARCH="${ARCH}" -e GOFLAGS=-buildvcs=false -e OWNER="$OWNER" \
    "$GO_IMAGE" sh -ec "
      go build -trimpath -tags embedui -ldflags '${LDFLAGS}' -o dist/${ARCH}/artex ./cmd/artex
      chown -R \"\$OWNER\" dist 2>/dev/null || true"
else
  CGO_ENABLED=0 GOOS=linux GOARCH="${ARCH}" go build -trimpath -tags embedui \
    -ldflags "${LDFLAGS}" -o "dist/${ARCH}/artex" ./cmd/artex
fi
[ -f "dist/${ARCH}/artex" ] || die "Binary missing (dist/${ARCH}/artex)"

info "4/4 Building Docker image ${IMAGE}:${TAG}…"
docker build --platform "linux/${ARCH}" --build-arg TARGETARCH="${ARCH}" -t "${IMAGE}:${TAG}" .

# Leave the working tree clean (these are build products, all git-ignored).
rm -rf server/webui web/out web/.next

ok "Image ready: ${IMAGE}:${TAG}"
ok "Start / restart with: docker compose up -d"
