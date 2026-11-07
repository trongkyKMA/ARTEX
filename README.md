# ARTEX (fork: English UI + hardening)

Autonomous AI penetration-testing platform (Go backend + Next.js frontend). This
fork keeps the upstream engine and adds:

- **English user interface**: UI, API errors, logs, notifications and reports. LLM prompts stay Chinese on purpose (tuned for DeepSeek / GLM).
- **Security fixes**:
  - one-time setup token, no `*` CORS, no cookie auth;
  - login throttling, JWT key rotation, masked MCP secrets, anti-framing headers;
  - patched npm / Go dependencies.
- **Intercept hardening** plus a built-in **operator policy**: no credential/OTP brute force, no password changes, no deletion of system files.
- **LLM provider presets** with suggested models.
- **Docker image built from this source** (`./docker-build.sh`).
- **MCP adapter for Claude Code** ([adapters/agent](adapters/agent/README.md)): read tasks and findings, re-verify findings, and write triage results back (writes opt-in, dry run first).

| Document | Contents |
|---|---|
| [docs/HUONG-DAN.md](docs/HUONG-DAN.md) | **Hướng dẫn cài đặt & vận hành** (tiếng Việt): Docker/local install, first login, LLM per agent, skills, intercept, tasks, backup, update, troubleshooting |
| [SECURITY-AND-L10N-NOTES.md](SECURITY-AND-L10N-NOTES.md) | What changed: localisation scope, fixed vulnerabilities (CVSS/CWE), dependency audit, intercept bypass fixes, tests |
| [docs/intercept-policy-rules.md](docs/intercept-policy-rules.md) | The 11 policy intercept rules, how they are seeded, how to tune them, test matrix |

Quick start (Docker, building the image from source; needs Go, Node.js and Docker):

```bash
git clone https://github.com/trongkyKMA/ARTEX.git && cd ARTEX
cp .env.example .env        # set POSTGRES_PASSWORD
./docker-build.sh           # build image artex-local:latest from this source
docker compose up -d
docker compose logs artex | grep "setup token"   # one-time token for http://<host>:8787/setup
```

Or use the prebuilt image from a release (needs `docker login ghcr.io` with a token that has `read:packages`):
set `ARTEX_IMAGE=ghcr.io/trongkykma/artex` and `ARTEX_TAG=latest` (or a release tag) in `.env`, then
`docker compose pull artex && docker compose up -d`.

> Do **not** use the upstream `autumn27/artex` image: it lacks this fork's changes. The in-app "Update" button and the release workflow point at this fork (`trongkyKMA/ARTEX`, images on `ghcr.io/trongkykma/artex`); see docs/HUONG-DAN.md §11.

## Access for colleagues (private repository)

This repository is private. To clone it, pull images or download releases you need to be a collaborator:

```bash
gh auth login                      # or use a personal access token for HTTPS
git clone https://github.com/trongkyKMA/ARTEX.git
```

Full installation and operations guide (Vietnamese): [docs/HUONG-DAN.md](docs/HUONG-DAN.md).
The original upstream README (Chinese) is kept for reference in [docs/README.upstream.zh.md](docs/README.upstream.zh.md); its install/update steps point at the upstream project and do not apply here.
