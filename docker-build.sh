#!/usr/bin/env bash
# Build the ARTEX Docker image from THIS source tree (English UI + security fixes +
# operator policy rules), instead of pulling the upstream autumn27/artex image.
#
#   ./docker-build.sh                 # image artex-local:latest for the host arch
#   ARTEX_IMAGE=myreg/artex ARTEX_TAG=v1 ./docker-build.sh
#   ARTEX_ARCH=arm64 ./docker-build.sh
#
# Steps: static-export the frontend -> embed it -> cross-compile a Linux binary into
# dist/<arch>/artex (the Dockerfile copies it from there) -> docker build.
#
# The binary is stamped with version "dev" on purpose: that disables the in-app
# one-click update, which downloads releases of the UPSTREAM repository and would
# replace this build with the original (untranslated, unpatched) version.
#
# Requirements on the build host: Go (>= 1.26, ideally latest patch), Node.js >= 20,
# npm, Docker.
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

command -v go >/dev/null 2>&1 || die "Go not found (https://go.dev/dl/)"
command -v npm >/dev/null 2>&1 || die "npm/Node.js not found (https://nodejs.org/)"
command -v docker >/dev/null 2>&1 || die "docker not found"

info "1/4 Building the frontend (static export)…"
# Install dependencies only on first build (or when ARTEX_NPM_CI=1, e.g. after a
# package-lock.json change); reinstalling every time is slow.
if [ ! -d web/node_modules ] || [ "${ARTEX_NPM_CI:-0}" = "1" ]; then
  (cd web && npm ci --no-audit --no-fund)
fi
# Same as `npm run build:static`, but sets NEXT_EXPORT in this shell so it also
# works where npm runs scripts through cmd.exe (Windows / Git Bash).
(cd web && NEXT_EXPORT=1 npx --no-install next build)

info "2/4 Embedding the frontend…"
rm -rf server/webui/dist
mkdir -p server/webui
cp -r web/out server/webui/dist

info "3/4 Compiling linux/${ARCH} binary…"
mkdir -p "dist/${ARCH}"
CGO_ENABLED=0 GOOS=linux GOARCH="${ARCH}" go build -trimpath -tags embedui \
  -ldflags "-s -w -X main.version=dev" -o "dist/${ARCH}/artex" ./cmd/artex

info "4/4 Building Docker image ${IMAGE}:${TAG}…"
docker build --platform "linux/${ARCH}" --build-arg TARGETARCH="${ARCH}" -t "${IMAGE}:${TAG}" .

# Leave the working tree clean (these are build products, all git-ignored).
rm -rf server/webui web/out web/.next

ok "Image ready: ${IMAGE}:${TAG}"
ok "Start / restart with: docker compose up -d"
