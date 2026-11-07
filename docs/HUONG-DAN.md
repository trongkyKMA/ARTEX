# ARTEX: Hướng dẫn cài đặt và vận hành (bản fork)

Tài liệu này dành cho bản ARTEX đã được chỉnh sửa trong repo này. Đọc từ đầu nếu cài mới, hoặc nhảy tới mục cần thiết.

**Mục lục**
1. [Bản fork này khác gì bản gốc](#1-bản-fork-này-khác-gì-bản-gốc)
2. [Yêu cầu hệ thống](#2-yêu-cầu-hệ-thống)
3. [Cài đặt bằng Docker (khuyến nghị)](#3-cài-đặt-bằng-docker-khuyến-nghị)
4. [Cài đặt chạy trực tiếp (không Docker)](#4-cài-đặt-chạy-trực-tiếp-không-docker)
5. [Lần đầu đăng nhập](#5-lần-đầu-đăng-nhập)
6. [Cấu hình LLM và model cho từng agent](#6-cấu-hình-llm-và-model-cho-từng-agent)
7. [Skill](#7-skill)
8. [Intercept: chặn hành vi bị cấm](#8-intercept-chặn-hành-vi-bị-cấm)
9. [Tạo task hiệu quả](#9-tạo-task-hiệu-quả)
10. [Vận hành 24/7: backup, log, reverse proxy](#10-vận-hành-247-backup-log-reverse-proxy)
11. [Cập nhật phiên bản](#11-cập-nhật-phiên-bản)
12. [Bảo mật khi triển khai nội bộ](#12-bảo-mật-khi-triển-khai-nội-bộ)
13. [Phát triển và kiểm thử](#13-phát-triển-và-kiểm-thử)
14. [Xử lý sự cố](#14-xử-lý-sự-cố)

---

## 1. Bản fork này khác gì bản gốc

| Hạng mục | Thay đổi | Chi tiết |
|---|---|---|
| Giao diện | Toàn bộ UI, thông báo lỗi, log, thông báo Telegram/Email, report: **tiếng Anh** | [SECURITY-AND-L10N-NOTES.md §1](../SECURITY-AND-L10N-NOTES.md) |
| Prompt LLM | **Giữ tiếng Trung** (hợp với DeepSeek/GLM); chỉ report và retest được yêu cầu viết tiếng Anh | như trên |
| Bảo mật | Setup token lần đầu, bỏ CORS `*`, bỏ xác thực bằng cookie, giới hạn đăng nhập sai, xoay khoá JWT, che secret MCP, header chống clickjacking | [SECURITY-AND-L10N-NOTES.md §2](../SECURITY-AND-L10N-NOTES.md) |
| Thư viện | Vá lỗ hổng npm (26 → 6, còn lại chỉ ở CLI dev) và Go module | như trên |
| Intercept | Vá 5 đường lách; **seed sẵn 11 rule chính sách** (không brute-force, không đổi mật khẩu, không xoá file hệ thống) | [docs/intercept-policy-rules.md](intercept-policy-rules.md) |
| LLM | Ô chọn **Provider** tự điền Format/Base URL và gợi ý model | §6 |
| Skill | Sửa frontmatter `scopesentry`, mở rộng mô tả `api-recon` | §7 |
| Docker | Build image **từ chính source này** (`./docker-build.sh`), không kéo image gốc | §3 |

> ⚠️ **Không dùng image `autumn27/artex` của tác giả gốc**: image đó không có các thay đổi ở trên. Nút "Update" trong app đã được trỏ về repo của anh (§11).

---

## 2. Yêu cầu hệ thống

| Thành phần | Phiên bản |
|---|---|
| Hệ điều hành | Linux x86_64/arm64 (khuyến nghị). Windows/macOS dùng được cho thử nghiệm |
| Docker + Docker Compose | Docker 24+ (cài bằng Docker) |
| Go | **≥ 1.26, nên dùng bản vá mới nhất**: ≥ 1.27.3 nếu dùng nhánh 1.27, để có các bản vá bảo mật của `net/http`, `crypto/tls` |
| Node.js + npm | Node ≥ 20 (để build giao diện) |
| PostgreSQL | 16 (Docker tự dựng; cài trực tiếp thì tự chuẩn bị) |
| RAM / Disk | ≥ 4 GB RAM, ≥ 20 GB disk (image có Chromium, nmap; traffic ghi lại chiếm dung lượng theo thời gian) |
| Mạng | Ra Internet tới API LLM (DeepSeek/GLM…); tới các target nội bộ trong phạm vi được phép |

---

## 3. Cài đặt bằng Docker (khuyến nghị)

Image Docker có sẵn các tool cần cho agent: nmap, curl, Playwright và Chromium, `playwright-cli`, ripgrep…

### Cách A: dùng script cài đặt

```bash
git clone <URL-repo-của-anh> ARTEX
cd ARTEX
./install.sh          # chọn 1) All Docker
```

Script sẽ hỏi mật khẩu Postgres (Enter để sinh ngẫu nhiên), tạo `.env`, **build image từ source** (`./docker-build.sh`) rồi chạy `docker compose up -d`.

### Cách B: từng bước thủ công

```bash
git clone <URL-repo-của-anh> ARTEX
cd ARTEX
cp .env.example .env
# Sửa .env: đặt POSTGRES_PASSWORD (bắt buộc, mật khẩu mạnh)
./docker-build.sh     # build image artex-local:latest từ source (lần đầu ~5–15 phút)
docker compose up -d
docker compose logs -f artex     # xem log, Ctrl-C để thoát
```

- `docker-build.sh` cần **Go, Node.js và Docker trên máy build**. Có thể build ở một máy khác rồi đẩy image lên registry nội bộ:
  - build với `ARTEX_IMAGE=registry.noibo/artex ARTEX_TAG=v1 ./docker-build.sh`, rồi `docker push`;
  - đặt `ARTEX_IMAGE`/`ARTEX_TAG` tương ứng trong `.env` trên server.
- Build cho ARM: `ARTEX_ARCH=arm64 ./docker-build.sh`.
- Sau khi đổi `package-lock.json` (nâng thư viện frontend), chạy `ARTEX_NPM_CI=1 ./docker-build.sh` để cài lại dependency.
- **Dữ liệu được giữ lại** khi tạo lại container: volume `pgdata` (database), thư mục `./data` (traffic, evidence, file làm việc của task), `./skills`.
- **Cổng** (chỉnh trong `.env`, không cần sửa `docker-compose.yml`):
  - `ARTEX_HTTP_PORT` (mặc định `8787`): giao diện + API.
  - `ARTEX_BIND` (mặc định `0.0.0.0`, tức mọi interface): đặt `127.0.0.1` để chỉ truy cập được từ chính máy đó, rồi đặt reverse proxy phía trước (§10).
  - `ARTEX_PROXY_PORT` (mặc định `8788`): proxy ghi traffic, luôn chỉ mở trên `127.0.0.1`.
  - Ví dụ chạy song song với một bản ARTEX khác trên cùng máy: `ARTEX_HTTP_PORT=8790`, `ARTEX_PROXY_PORT=8791`.

---

## 4. Cài đặt chạy trực tiếp (không Docker)

Dùng khi không có Docker. Lưu ý: agent sẽ dùng các tool **cài trên máy** (nmap, curl, `playwright-cli`…). Thiếu tool nào thì agent không dùng được tool đó.

```bash
git clone <URL-repo-của-anh> ARTEX
cd ARTEX
./install.sh          # chọn 2) Local build, script hỏi thông tin DB và tạo config.json (quyền 600)
```

Hoặc thủ công:

```bash
cp config.example.json config.json      # điền thông tin PostgreSQL, rồi: chmod 600 config.json
cd web && npm ci && npm run build:static && cd ..
rm -rf server/webui/dist && mkdir -p server/webui && cp -r web/out server/webui/dist
CGO_ENABLED=0 go build -tags embedui -o artex ./cmd/artex
./start.sh            # Windows: start.bat
```

- Luôn khởi động bằng `start.sh`/`start.bat` (tự khởi động lại khi process thoát), không chạy `./artex` trực tiếp.
- Chạy nền: `nohup ./start.sh > artex.log 2>&1 &`.
- Có thể dùng biến môi trường `ARTEX_PG_DSN=postgres://user:pass@host:5432/artex?sslmode=disable` thay cho `config.json`.
- Cài tool cho agent (Ubuntu/Debian): `sudo apt install nmap curl jq ripgrep`. Với skill `playwright-cli`: `npm i -g @playwright/cli playwright && playwright install --with-deps chromium`.

---

## 5. Lần đầu đăng nhập

1. Mở **http://<máy-chủ>:8787**. Trang tự chuyển tới `/setup`.
2. Lấy **Setup token** (token dùng một lần, chống người khác chiếm quyền admin trước anh):
   - Docker: `docker compose logs artex | grep "setup token"` hoặc `docker compose exec artex cat /app/setup.token`
   - Chạy trực tiếp: file `setup.token` nằm cạnh file `artex`, hoặc xem dòng `[auth] … setup token …` trong log.
   - Muốn tự đặt trước: biến `ARTEX_SETUP_TOKEN` trong `.env`.
3. Nhập token, đặt mật khẩu (≥ 8 ký tự). Token tự huỷ sau khi dùng.
4. Các lần sau đăng nhập với **username `ARTEX`** và mật khẩu vừa đặt.

Lưu ý:
- Sai mật khẩu **5 lần trong 15 phút** từ cùng một IP thì bị khoá tạm (HTTP 429). Đợi 15 phút hoặc khởi động lại server.
- **Đổi mật khẩu** (menu tài khoản góc dưới trái) sẽ **đăng xuất mọi phiên khác**.
- Quên mật khẩu: xem §14.

---

## 6. Cấu hình LLM và model cho từng agent

### Tạo profile LLM
**System → LLM → New**:
1. **Provider:** chọn DeepSeek / Zhipu GLM (BigModel, Trung Quốc) / Z.ai GLM (quốc tế) / Anthropic / OpenAI / Custom. Form tự điền **Format** và **Base URL** đúng chuẩn.
2. **Model:** click chip gợi ý, hoặc nhập API key rồi bấm **⟳** để lấy danh sách model chính xác từ nhà cung cấp (nguồn tin cậy nhất).
3. **API key** → **Test connection** → **Create** → bấm **Set active** trên card để làm profile mặc định.

Ghi nhớ:
- **DeepSeek:** tên `deepseek-chat`/`deepseek-reasoner` đã bị bỏ từ 07/2026, dùng `deepseek-v4-pro` / `deepseek-v4-flash`.
- **GLM:** tài khoản gói Coding Plan có thể chỉ dùng được Format OpenAI, với Base URL riêng `…/api/coding/paas/v4`.
- Form cảnh báo nếu model ID có khoảng trắng hoặc ký tự full-width. Lỗi này hay gặp khi copy từ tài liệu tiếng Trung.

### Gán model cho từng agent
**System → Agent →** chọn agent → chọn LLM profile. Agent không được gán sẽ dùng profile đang active.

| Agent | Vai trò | Khuyến nghị |
|---|---|---|
| **Planner** | Quyết định hướng khám phá (intent) | **Model mạnh** (vd. `glm-5.3`, `deepseek-v4-pro`) |
| **Worker** | Chạy lệnh, khai thác, xác minh, gọi skill | **Model mạnh** nếu ngân sách cho phép. Đây là agent tốn token nhất |
| Pentest | Chế độ tự chạy trọn chuỗi | Mạnh, nếu dùng chế độ này |
| Goal Decomposition, Main, Report writer, Finding retest, Auto | Phụ trợ | Model nhẹ (`*-flash`) là đủ |

---

## 7. Skill

Skill là bộ hướng dẫn và script mà agent tự nạp khi gặp việc phù hợp. Quản lý ở **System → Skill**, bật/tắt theo từng agent.

| Skill | Mặc định gán cho | Dùng để | Điều kiện |
|---|---|---|---|
| `api-recon` | Worker, Pentest, Auto | Thu thập API endpoint, route, tham số của web app (tĩnh từ JS bundle + chạy Chrome headless) | Chạy tốt nhất trong Docker image |
| `playwright-cli` | Worker, Pentest (gán một lần khi cài mới) | Điều khiển trình duyệt headless: trang SPA/JS, luồng đăng nhập nhiều bước, xác minh XSS phía client, kiểm tra cookie/localStorage, chụp snapshot làm bằng chứng | Image Docker có sẵn, cùng Chromium đúng phiên bản. Khi bật ghi traffic, request của trình duyệt được ghi làm bằng chứng và lỗi chứng chỉ của proxy được bỏ qua tự động |
| `scopesentry` | (tắt) | Lấy asset từ nền tảng ScopeSentry qua MCP | Cần instance ScopeSentry; cấu hình ở **Asset sync** |

Lưu ý:
- Trang Skill chỉ hiện số lượt gọi **khi agent thực sự gọi skill**. Để agent dùng `api-recon`, task cần có goal hoặc intent liên quan tới web app (xem §9). Planner dùng model mạnh cũng giúp ích.
- Mô tả skill (`description` trong `SKILL.md`) bị cắt ở **500 byte**. Tiếng Trung chiếm 3 byte/ký tự, nên giữ mô tả dưới khoảng 160 ký tự.
- Sửa file skill trong `./skills` có hiệu lực ở lượt chạy kế tiếp của agent, không cần khởi động lại.
- Script của `api-recon` dùng `puppeteer-core` 23, đang có lỗ hổng đã công bố (mức độ thấp với cách dùng hiện tại). Nên nâng lên v25 khi có thời gian test lại.
- **`playwright-cli` khi chạy trực tiếp (không Docker):**
  - Cài `npm i -g @playwright/cli` rồi `playwright-cli install-browser chromium`.
  - Đặt biến môi trường `PLAYWRIGHT_MCP_BROWSER=chromium` cho process ARTEX. Nếu không, CLI tìm Google Chrome ở `/opt/google/chrome` và báo lỗi.
- Kiểm tra nhanh trong container: `docker compose exec artex playwright-cli open https://example.com`, rồi `playwright-cli snapshot`, rồi `playwright-cli close`.

---

## 8. Intercept: chặn hành vi bị cấm

**Intercept** chặn tool call của agent theo rule, trước khi lệnh được chạy. Rule áp dụng cho:
- **Tool:** `Bash`, shell tương tác, `Write`/`Edit`, `WebFetch`, `web_search`, tool MCP `mcp__*`, custom tool loại command/script/http;
- **Agent:** Worker, Planner, Main và các chat agent.

### Chính sách 3 tiêu chí: đã cài sẵn
Khi khởi động lần đầu, ARTEX tự thêm **11 rule `[Policy] …`** (action `deny`, không chờ người duyệt):
1. **Không brute-force** tài khoản/OTP: chặn `hydra`, `medusa`, `ncrack`, `nmap --script *brute*`, Metasploit `*_login`, wordlist mật khẩu nhắm vào target, `ffuf` vào trường password/OTP, vòng lặp thử OTP.
2. **Không đổi/reset mật khẩu:** chặn `passwd`, `chpasswd`, `usermod -p`, `net user <u> <pass>`, SQL `ALTER USER … PASSWORD`, `UPDATE users SET password…`, request HTTP gửi `newPassword` hoặc POST tới `reset/change-password`.
3. **Không xoá file/thư mục hệ thống:** chặn `rm`/`find -delete`/`shutil.rmtree`… vào `/etc`, `/usr`, `/var/www`, `/home`, `/`, `~`, `../`, file của ARTEX. **Vẫn cho xoá** file agent tạo ra: đường dẫn tương đối, `/tmp`, `/var/tmp`, `/dev/shm`.

Rule **không** chặn kỹ thuật test thông thường: thử vài mật khẩu mặc định, `ffuf` quét thư mục, `sqlmap`, `nmap -sV`, đọc file, crack hash offline…

- **Kiểm tra:** vào **System → Intercept rules**, phải thấy 11 rule `[Policy]` đang bật. Hai rule mặc định `[Built-in] Recursive force delete rm -rf` và `[Built-in] Delete critical system directories` bị **tắt có chủ đích**, vì chúng chặn cả việc agent dọn file của chính nó.
- **Lịch sử chặn:** **System → Intercept rules → History**, hoặc tab Intercept trong từng task.
- **Chi tiết từng rule và cách sửa:** [docs/intercept-policy-rules.md](intercept-policy-rules.md).

### Giới hạn cần nhớ
- Regex không bắt hết mọi cách viết lệnh (vd. `r''m`, base64 | sh). Vì vậy **luôn thêm Constraints vào task** (§9) để agent tự tuân thủ ngay từ khi lập kế hoạch.
- **LLM judge** (chấm bằng model những lệnh không khớp rule) đang **tắt**. Bật ở **Intercept rules → LLM judge** nếu muốn thêm một lớp chặn hiểu được ngữ nghĩa lệnh. Đổi lại, mỗi lệnh không khớp rule sẽ tốn thêm một lần gọi LLM.
- Chặn theo asset (**Asset intercept**) chỉ được kiểm khi tạo intent hoặc thêm asset, không kiểm lúc chạy lệnh. Giới hạn phạm vi mạng thật sự phải làm bằng firewall (§12).

---

## 9. Tạo task hiệu quả

**Tasks → New task**: mô tả target và mục tiêu. Agent **Goal Decomposition** tự tách thành các goal và constraint. Viết bằng **tiếng Anh** (hoặc tiếng Trung) để model hiểu chính xác nhất.

### Goals: quyết định khi nào task dừng
Task tự kết thúc khi **mọi goal đạt `met`**. Nếu goal chỉ mang tính kiểm kê (liệt kê cổng/dịch vụ), task sẽ dừng rất sớm. Nên thêm goal đào sâu:

```
Enumerate all API endpoints, routes and parameters of every discovered web service (use the api-recon skill).
Identify and verify vulnerabilities on the discovered web services; prove each finding with the least invasive PoC possible.
```

- **Thêm goal:** task → tab **Overview** → card **Goal management** → nhập → **Add**. Thêm goal sẽ **tự kích hoạt lại** task đã xong.

### Constraints: luật chơi cho agent
Ở card **Constraints** (ngay dưới Goals). Goal Decomposition có thể tự sinh constraint `allow` rất hẹp (chỉ cho quét cổng). **Kiểm tra và sửa** cho khớp mục tiêu, ví dụ:

| Loại | Nội dung |
|---|---|
| allow | `Allowed on this host only: port/service scanning, HTTP(S) probing, web API/route enumeration (api-recon), and vulnerability verification with minimal, non-destructive PoCs.` |
| deny | `Do not scan or probe any host, domain or IP other than <target>.` |
| deny | `Do not brute-force user credentials or OTP codes.` |
| deny | `Do not change or reset any system or user passwords.` |
| deny | `Do not delete system files or directories (only files created by the agent may be removed).` |

Constraint không kích hoạt lại task; Planner đọc ở vòng lập kế hoạch kế tiếp.

### Theo dõi
- **Tab Sessions/Graph:** intent và hướng đi của agent.
- **Findings:** lỗ hổng tìm được. Report từng lỗ hổng do agent **Report writer** viết bằng tiếng Anh.
- **System → Skill:** số lượt gọi skill.
- **System → Logs:** log backend.

---

## 10. Vận hành 24/7: backup, log, reverse proxy

**Log**
- Docker: `docker compose logs -f artex`
- Trong UI: **System → Logs**

**Khởi động lại**
- Docker: `docker compose restart artex`
- Chạy trực tiếp: dừng `start.sh` rồi chạy lại.
- Lưu ý: khởi động lại sẽ đưa intent đang chạy về trạng thái `open`, rồi chạy lại từ đầu.

**Backup** (nên làm định kỳ)

```bash
# Database
docker compose exec -T postgres pg_dump -U artex artex | gzip > artex-db-$(date +%F).sql.gz
# Dữ liệu file (traffic, evidence, file làm việc)
tar czf artex-data-$(date +%F).tgz data/
```

Khôi phục DB: `gunzip -c artex-db-<ngày>.sql.gz | docker compose exec -T postgres psql -U artex artex`.

**Reverse proxy (HTTPS):** UI, API và SSE dùng chung cổng 8787. Với Nginx bắt buộc **tắt buffering**, nếu không luồng hoạt động realtime sẽ không cập nhật:

```nginx
location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 3600s;
}
```

Lưu ý: sau reverse proxy, mọi client chung IP của proxy, nên giới hạn đăng nhập sai (5 lần / 15 phút) áp dụng chung cho mọi người.

---

## 11. Cập nhật phiên bản

Cập nhật **từ repo của anh**, không lấy từ tác giả gốc:

```bash
cd ARTEX
git pull
./update.sh       # chọn 1) Docker update → tự build lại image từ source và tạo lại container
```

Hoặc thủ công: `git pull && ./docker-build.sh && docker compose up -d`.

- **Database tự migrate** khi khởi động (schema và các migration rule). Không cần chạy gì thêm. Vẫn nên backup trước khi cập nhật.

### Cập nhật trong app (System → Settings → Update)

Nút Update giờ lấy bản phát hành từ **repo của anh** (`trongkyKMA/ARTEX-VPB`, ghi cứng trong `selfupdate/github.go`), không còn từ repo gốc. Để dùng:

1. **Phát hành một phiên bản:** gắn tag rồi push.
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   GitHub Actions (`.github/workflows/release.yml`) sẽ:
   - build frontend và binary cho Linux/macOS/Windows;
   - tạo **Release** đính kèm file zip và `SHA256SUMS`;
   - đẩy image Docker lên `ghcr.io/trongkykma/artex:v1.0.0` và `:latest`.

   Theo dõi ở tab **Actions** của repo.
2. **Token:** repo private, nên process ARTEX cần biến `ARTEX_UPDATE_GITHUB_TOKEN`.
   - Tạo fine-grained token chỉ cho repo `trongkyKMA/ARTEX-VPB`, quyền **Contents: Read-only**.
   - Docker: điền vào `.env`. Chạy trực tiếp: export trước khi chạy `./start.sh`.
3. **Bấm Update:** app tải đúng file cho nền tảng, kiểm tra `SHA256SUMS`, chạy thử binary mới, rồi khởi động lại bằng bản mới. Có nút quay về bản trước.

Lưu ý:
- **Chỉ binary mang phiên bản dạng tag** (vd. `v1.0.0`, tức bản lấy từ Release hoặc build bằng `ARTEX_BUILD_VERSION=v1.0.0 ./build.sh`) mới dùng được nút Update. Bản build bằng `docker-build.sh` mang phiên bản `dev`, nên nút bị vô hiệu.
- **Với Docker,** nút Update chỉ thay binary *bên trong* container. Tạo lại container (`docker compose up -d`) là quay về binary của image. Vì vậy với Docker nên cập nhật bằng `./update.sh` hoặc `./docker-build.sh`, hoặc dùng image từ GHCR:
  - đặt `ARTEX_IMAGE=ghcr.io/trongkykma/artex` và `ARTEX_TAG=v1.0.0` trong `.env`;
  - đăng nhập `docker login ghcr.io` (dùng token có quyền `read:packages`);
  - chạy `docker compose pull artex && docker compose up -d`.
- Cơ chế cập nhật kiểm tra checksum nhưng **chưa có chữ ký số**: ai kiểm soát được repo/Release thì kiểm soát được bản cập nhật. Hãy bảo vệ tài khoản GitHub bằng 2FA.

---

## 12. Bảo mật khi triển khai nội bộ

- **Không mở cổng 8787 ra Internet.** Chỉ mở trong mạng quản trị, hoặc qua reverse proxy HTTPS có giới hạn IP.
- **Giới hạn mạng ra (egress)** của máy chạy ARTEX bằng firewall dạng allowlist, chỉ tới các dải UAT/staging được phép test và API LLM. Đây là lớp chặn chính; intercept và constraints là lớp phụ.
- Giữ bí mật `.env` và `config.json` (chứa mật khẩu DB). `.gitignore` đã loại trừ chúng.
- Để `ARTEX_CORS_ORIGINS` **rỗng** khi chạy thật (giao diện và API cùng origin).
- Build bằng Go bản vá mới nhất (§2) để có các bản vá bảo mật của thư viện chuẩn.
- Chi tiết các lỗ hổng đã fix và các khuyến nghị còn mở (container chạy root, self-update không có chữ ký): [SECURITY-AND-L10N-NOTES.md](../SECURITY-AND-L10N-NOTES.md).

---

## 13. Phát triển và kiểm thử

**Chạy dev** (backend + frontend hot reload):

```bash
./dev.sh          # backend :8787, proxy :8788, frontend http://localhost:5173
```

`dev.sh` tự đặt `ARTEX_CORS_ORIGINS` cho `localhost:5173/3000`. Truy cập từ IP khác thì đặt thêm, ví dụ `ARTEX_CORS_ORIGINS=http://10.0.0.5:5173 ./dev.sh`.

**Chế độ demo giao diện** (không cần backend): `cd web && NEXT_PUBLIC_MOCK=1 npx next dev`.

**Kiểm thử**

```bash
go build ./... && go vet ./...
ARTEX_PG_DSN='postgres://artex:pass@127.0.0.1:5432/artex_test?sslmode=disable' go test -p 1 ./...
go test ./db/ -run TestPolicyRulesBehaviour      # 57 ca của bộ rule chính sách
cd web && npx tsc --noEmit && node --test src/lib/*.test.mjs
```

- **Trên Windows,** một số test fail sẵn từ bản gốc, do đường dẫn hoặc quyền file: `TestSkillRelPath`, các test `evidence`/`finding_traffic`. `TestCompanyScopeAttribution` phụ thuộc trạng thái DB. Đây không phải lỗi mới.

**File cần cập nhật khi thay đổi:**

| Khi nào | File |
|---|---|
| Nhà cung cấp LLM đổi tên model | `web/src/lib/llm-presets.ts` |
| Mô tả mặc định của tool thay đổi trong code | Sinh lại `web/src/lib/tool-translations.ts`. Nếu không, trang Tools sẽ hiện lại mô tả gốc tiếng Trung |
| Đổi bộ rule chính sách cho bản cài mới | `db/policy_rules.json`, rồi chạy `TestPolicyRulesBehaviour` |

---

## 14. Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| Quên mật khẩu admin | Docker: `./reset-password.sh -m docker`. Chạy trực tiếp: `./reset-password.sh` (đọc `config.json`). Username luôn là `ARTEX` |
| Mất setup token khi chưa setup | Khởi động lại server. Token mới được in ra log và ghi vào `setup.token` |
| Đăng nhập báo "Too many failed…" (429) | Đợi 15 phút hoặc khởi động lại server |
| `docker compose up` báo không pull được `artex-local` | Chưa build image: chạy `./docker-build.sh` trước |
| Giao diện vẫn tiếng Trung / thiếu tính năng mới | Đang chạy image gốc `autumn27/artex`. Kiểm tra `ARTEX_IMAGE` trong `.env` và `docker compose config \| grep image` |
| Activity/log không cập nhật realtime sau reverse proxy | Tắt buffering ở proxy (§10) |
| Sửa rule thẳng trong DB nhưng chưa có hiệu lực | Gạt tắt rồi bật lại một rule bất kỳ trên UI để server nạp lại |
| Agent không gọi skill | Thêm goal/intent liên quan tới web app; dùng model mạnh cho Planner/Worker; kiểm tra skill đã bật cho agent (System → Skill) |
| Task dừng quá sớm | Goal quá dễ đạt. Thêm goal đào sâu (§9) |
| Lệnh hợp lệ bị intercept chặn nhầm | Xem lịch sử chặn để biết rule nào. Tắt hoặc sửa rule đó trên UI |
| `docker-build.sh` lỗi `EPERM … next-swc` khi `npm ci` (Windows) | Có tiến trình `next dev` đang giữ file. Tắt nó rồi chạy lại với `ARTEX_NPM_CI=1` |
