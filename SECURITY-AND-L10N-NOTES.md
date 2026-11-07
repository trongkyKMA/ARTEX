# ARTEX – English UI localisation & security hardening notes

Ngày: 2026-11-07 · Phạm vi: toàn bộ source `ARTEX-main` (Go backend + Next.js `web/`)

## 1. Chuyển giao diện sang tiếng Anh

**Nguyên tắc:** chỉ đổi chuỗi người dùng nhìn thấy, không đổi logic.

| Khu vực | Đã dịch |
|---|---|
| `web/src/**` (trừ `lib/mock/**`) | Toàn bộ text JSX, label, placeholder, toast, confirm, status/severity label, menu sidebar, trang login/setup, điều khoản sử dụng; locale `zh-CN` → `en-US` |
| `server/` | Thông báo lỗi API (`writeErr`), thông báo validation, reply của fallback chat, log message |
| `notify/`, `report/` | Template thông báo (Telegram/Email/Webhook/DingTalk/Feishu/WeCom), nhãn severity/status, report Markdown/CSV |
| `db/`, `config/`, `cmd/`, `selfupdate/`, `traffic/`, `evidence/`, `sidequestion/`… | Lỗi trả về UI, log, tên/mô tả agent built-in (seed), nhãn biến prompt |
| Script | `install.sh`, `start.sh`, `start.bat`, `update.sh`, `reset-password.sh`, `dev.sh`, `build.sh` (chỉ echo/prompt) |

**Cố ý giữ tiếng Trung** (vì là logic hoặc dữ liệu đã lưu):
- Toàn bộ **prompt / tool description / tool result gửi cho LLM** (`agent/`, `intercept/prompt.go`, `platform_tools.go`, `guard/`, `TrafficSearchDescription`…). Đây là quyết định của chủ dự án: LLM dùng là DeepSeek/GLM nên prompt tiếng Trung vẫn ổn, và các agent vẫn trao đổi với nhau bằng tiếng Trung. **Ngoại lệ (report ra tiếng Anh):** chỉ đổi phần chỉ định ngôn ngữ đầu ra, phần còn lại của prompt giữ nguyên:
  - Agent viết report lỗ hổng (`agent/promptcatalog.go: ReporterDefaultPrompt`): tiêu đề các mục đổi sang tiếng Anh (`## Overview`, `## Impact`, `## Steps to Reproduce`, `## Evidence`, `## PoC`, `## Root Cause`, `## Remediation`), kèm dòng yêu cầu viết toàn bộ report bằng tiếng Anh.
  - Agent retest (`agent/retester.go`): yêu cầu trả lời và ghi kết luận retest bằng tiếng Anh.
  - Report tổng hợp của task (`report/`) do code sinh ra nên đã là tiếng Anh. Tuy nhiên tiêu đề và tóm tắt của từng finding do worker LLM ghi bằng tiếng Trung, nên vẫn giữ tiếng Trung. Các nội dung do LLM sinh khác (trả lời chat, tóm tắt intent, lý do kết thúc) cũng vậy.
  - **Database đã cài từ trước:** prompt và tên agent được seed một lần vào DB, nên bản cài cũ vẫn giữ prompt tiếng Trung. Cần sửa trong **System → Agent** (`Report writer` / `Finding retest`), hoặc cài mới.
- Marker lưu trong DB hoặc được parse: `[模型]`, `实际操作：`, `备案`, tiền tố lệnh `意图`/`提示`, định dạng mention `@[漏洞#id …]` (UI hiển thị "Finding #id"), summary `工具 X 请求审批`, ghi chú phiên bản prompt `内置默认`.
- Comment trong code (để diff dễ review).
- **Mô tả tool trên trang System → Tools** (51 tool, 192 tham số): đây là text gửi cho LLM nên DB vẫn giữ tiếng Trung. UI có thêm **bản dịch chỉ để hiển thị** (`web/src/lib/tool-translations.ts`, sinh tự động, kèm hash của bản gốc):
  - Card tool, danh sách tool trong Agent editor và trang Intercept hiện tiếng Anh khi mô tả còn là bản mặc định.
  - Khi mở để sửa, ô gốc (gửi cho LLM) giữ nguyên, bên dưới có khung "English reference".
  - Nếu operator đã sửa mô tả, UI hiện đúng nội dung đã sửa và ghi chú rằng bản dịch tham khảo đã cũ.
  - Nếu sau này code đổi mô tả mặc định của tool, cần sinh lại file này, nếu không UI sẽ quay về hiện mô tả gốc.
- Mock data demo `web/src/lib/mock/*`, chỉ dùng khi `NEXT_PUBLIC_MOCK=1`.

**Thay đổi logic nhỏ để tương thích:**
- Các so khớp chuỗi giữa frontend và backend chấp nhận cả hai dạng Anh và Trung (`archive not found`/`归档不存在`, `already exists`/`已存在`). Backend tự đổi tên hội thoại khi tiêu đề là `New chat` hoặc `新对话` (dữ liệu cũ).
- `server/logsink.go`: thêm từ khoá tiếng Anh để phân loại mức log.

## 2. Lỗ hổng bảo mật đã fix

| # | Lỗ hổng | Severity | CVSS 3.1 | CWE | Trạng thái |
|---|---|---|---|---|---|
| 1 | Chiếm quyền setup lần đầu (`/api/auth/init` không cần xác thực) + CORS `*` → RCE qua MCP stdio | High | 8.1 `AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H` | CWE-306, CWE-942 | **Fixed** |
| 2 | API chấp nhận cookie `artex_token` (đọc được bằng JS, SameSite=Lax) → CSRF từ site cùng domain → RCE | High | 7.5 `AV:N/AC:H/PR:N/UI:R/S:U/C:H/I:H/A:H` | CWE-352, CWE-1004 | **Fixed** |
| 3 | Không giới hạn số lần đăng nhập sai (username cố định `ARTEX`) | Medium | 5.9 `AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N` | CWE-307 | **Fixed** |
| 4 | JWT nhận qua `?token=` ở mọi endpoint (lọt vào log, Referer, history) | Medium | 4.8 `AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N` | CWE-598 | **Fixed** |
| 5 | Thiếu anti-framing header (clickjacking) | Medium | 4.3 `AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N` | CWE-1021 | **Fixed** |
| 6 | Đổi mật khẩu không thu hồi token cũ (TTL 7 ngày) | Low | 3.7 `AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N` | CWE-613 | **Fixed** |
| 7 | `GET /api/mcp` trả secret (API key/Authorization header) dạng plaintext | Low | 2.7 `AV:N/AC:L/PR:H/UI:N/S:U/C:L/I:N/A:N` | CWE-200 | **Fixed** |
| 8 | `install.sh` publish Postgres ra `0.0.0.0:5432`; `config.json` chứa mật khẩu DB bị world-readable | Low | — | CWE-668, CWE-732 | **Fixed** |
| 9 | Container chạy root | Low | — | CWE-250 | Khuyến nghị (chưa đổi) |
| 10 | Self-update chỉ kiểm SHA256SUMS lấy từ chính release đó, không có chữ ký | Low | — | CWE-494 | Khuyến nghị (chưa đổi) |
| 11 | `docker-compose.yml` bind 8787 trên mọi interface | Info | — | CWE-668 | Khuyến nghị (chưa đổi) |

### Chi tiết các fix

1. **Setup token** (`server/auth_guard.go`, `server/auth.go: authInit`): khi chưa có mật khẩu admin, server sinh token ngẫu nhiên một lần (hoặc lấy từ env `ARTEX_SETUP_TOKEN`), in ra log và ghi vào `<BaseDir>/setup.token` (quyền 0600). `POST /api/auth/init` bắt buộc gửi `setup_token`, so sánh constant-time. Token bị huỷ sau khi setup thành công. Trang `/setup` có thêm ô "Setup token".
   **CORS** (`server/server.go: cors`): bỏ `*`. Chỉ trả `Access-Control-Allow-Origin` cho các origin trong `ARTEX_CORS_ORIGINS` (mặc định rỗng, production chạy same-origin). `dev.sh` tự set origin cho `next dev`.
2. **Bỏ cookie auth** (`extractToken`): backend chỉ nhận `Authorization: Bearer`. Frontend không ghi JWT vào cookie nữa, chỉ ghi cờ `artex_authed=1` (SameSite=Strict) cho middleware điều hướng. Cookie cũ vẫn được middleware chấp nhận để phiên hiện tại không bị vòng lặp redirect.
3. **Rate limit** (`loginLimiter`): sau 5 lần sai trong 15 phút từ cùng IP thì trả 429. Áp dụng cho login, change-password (mật khẩu cũ) và setup token. Lưu ý: nếu đặt sau reverse proxy thì mọi client chung IP proxy.
4. **Query token** chỉ được chấp nhận cho `GET /api/**/stream` và `/api/**/events` (EventSource).
5. **Header** `X-Frame-Options: DENY`, `CSP frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer` cho UI nhúng (`server/webui_embed.go`).
6. **Xoay khoá JWT** khi đổi mật khẩu (`rotateSigningKey`): mọi token cũ mất hiệu lực, phiên hiện tại nhận token mới.
7. **Mask secret MCP**: `GET /api/mcp` trả `******`. Khi lưu, giá trị `******` được giữ nguyên secret cũ (`restoreMaskedMCPEnv`).
8. `install.sh`: `-p 127.0.0.1:5432:5432`, `chmod 600 config.json`.

### Lỗ hổng thư viện bên thứ ba (SCA)

| Thành phần | Trước | Sau | Cách xử lý |
|---|---|---|---|
| `web/` (npm) | 26 lỗ hổng: 2 critical (`next` middleware bypass, `proxy-addr`), 15 high (`undici`, `postcss`, `sharp`, `systeminformation`, `zod`, `@modelcontextprotocol/sdk`…) | 6 (4 moderate, 2 low) | `npm audit fix` không nâng major (chỉ đổi `package-lock.json`, ví dụ next 16.2.9 → 16.4.5). 6 lỗ hổng còn lại nằm trong CLI `shadcn` (`minimatch`, `deepmerge`, `ts-morph`): chỉ dùng để sinh code lúc dev, không có trong bản build tĩnh. |
| Go modules | 3 lỗ hổng gọi tới được (`golang.org/x/net` v0.58.0, `klauspost/compress` v1.18.6) | 0 | Nâng `x/net` lên v0.62.0, `compress` lên v1.20.2 (kéo theo `x/crypto`, `x/sys`, `x/text`…). |
| Thư viện chuẩn Go | 10 lỗ hổng (`net/http`, `http2`, `crypto/tls`, `crypto/x509`, `mime/multipart`) trong go1.27.0 | — | **Build bằng Go ≥ 1.27.3** (hoặc bản vá mới nhất của 1.26.x như CI đang dùng `go-version: "1.26"`). Không cần sửa code. |
| `skills/api-recon/scripts` (puppeteer-core 23) | 10 high (`extract-zip`, `basic-ftp`, `zod`, `ip-address`) | Chưa đổi | Cần nâng major lên `puppeteer-core@^25.16`. Các lỗ hổng nằm ở đường tải trình duyệt/PAC proxy mà script không dùng. Nên nâng sau khi test lại skill. |

Lưu ý: frontend production là bản **static export** nhúng vào binary Go. Các lỗ hổng phía server của Next.js/Node chỉ ảnh hưởng khi chạy `next dev`/`next start`.

### Preset nhà cung cấp LLM (System → LLM → New)

`web/src/lib/llm-presets.ts` + form trong `system/llm/page.tsx`: thêm ô **Provider** (DeepSeek, Zhipu GLM BigModel, Z.ai GLM, Anthropic, OpenAI, Custom).
- Chọn provider sẽ tự điền **Format** và **Base URL**, đúng quy tắc ghép URL của backend (`/v1/messages`, `/chat/completions`, `/responses`). Đổi Format thì Base URL đổi theo.
- Danh sách **model gợi ý** hiện dạng chip, click để chọn. Đây là ảnh chụp tại thời điểm 11/2026, ví dụ DeepSeek `deepseek-v4-pro`/`deepseek-v4-flash` (tên `deepseek-chat`/`deepseek-reasoner` đã bị bỏ từ 07/2026), GLM `glm-5.3`/`5.2`/`5.1`. Nút ⟳ lấy danh sách chính xác từ API của nhà cung cấp vẫn là nguồn đáng tin nhất.
- Cảnh báo khi model ID có khoảng trắng hoặc ký tự full-width.
- Provider chỉ là công cụ hỗ trợ trên UI, **không lưu vào DB** và không đổi API hay backend. Config cũ được tự nhận diện provider dựa trên Base URL.
- Cần cập nhật `llm-presets.ts` khi nhà cung cấp đổi tên model.

### Sửa lỗi skill `scopesentry`

`skills/scopesentry/SKILL.md` có frontmatter hỏng: dòng `## name: scopesentry-mcp` và thiếu `---` đóng. Loader `norma` vì vậy hiểu YAML kéo dài tới đường kẻ ngang `---` trong thân bài, dẫn tới:
- skill không có description, nên agent không biết khi nào cần dùng;
- toàn bộ mục "1. 准备工作" (cấu hình endpoint MCP, API key) bị cắt khỏi hướng dẫn;
- mất khai báo `mcps: ScopeSentry` mà `db/db.go` (`builtinSkillVisibility`) đã mô tả.

Đã khôi phục frontmatter đúng chuẩn agentskills.io:
- `name: scopesentry`, trùng tên thư mục, vì ARTEX bật/tắt skill theo tên thư mục;
- `description`;
- `mcps: ScopeSentry`.

Khi skill được bật cho một agent, MCP ScopeSentry (nếu đã cấu hình và bật) sẽ tự kết nối và mở khoá tool lúc skill được gọi. Skill vẫn tắt mặc định, như trước.

### Sửa skill `playwright-cli` để dùng được ngay

Đã chạy thử trong image Docker và phát hiện 3 vấn đề khiến skill không dùng được:

| Vấn đề | Hậu quả | Cách sửa |
|---|---|---|
| CLI mặc định dùng Google Chrome (`/opt/google/chrome`), nhưng image chỉ cài Chromium | `playwright-cli open` lỗi ngay ở bước đầu | `Dockerfile`: `ENV PLAYWRIGHT_MCP_BROWSER=chromium` |
| CLI đi kèm `playwright-core` riêng, cần Chromium bản 1252, trong khi gói `playwright` cài bản 1254 | Báo "browser is not installed" | `Dockerfile`: thêm `playwright-cli install-browser chromium` |
| Khi bật ghi traffic, Chromium đi qua proxy MITM nhưng không tin CA của proxy (chỉ curl/python/node đọc các biến CA) | Mọi trang HTTPS báo `ERR_CERT_AUTHORITY_INVALID` | `agent/worker.go: proxyEnv` thêm `PLAYWRIGHT_MCP_IGNORE_HTTPS_ERRORS=true`, **chỉ khi** proxy ghi traffic đang bật |

Sau khi sửa, `playwright-cli open https://…` tải được trang, **và traffic của trình duyệt được ghi vào kho bằng chứng** (dùng được với `traffic_search`/`bind_finding_traffic`).

Ngoài ra:
- Mô tả skill được viết lại theo tình huống pentest: SPA, luồng đăng nhập, XSS phía client, cookie/CSP, bằng chứng. Đầu `SKILL.md` có thêm mục "Using it inside ARTEX".
- Skill được gán **một lần** cho Worker và Pentest khi cài mới (`seedPlaywrightSkillVisibilityV1`, cờ `skill_visibility_playwright_v1`). Anh tắt đi thì lần khởi động sau không tự bật lại.

### Mở rộng mô tả skill `api-recon`

Mô tả gốc ("收集网站API接口时调用该skill。") quá hẹp, nên agent ít khi gọi skill này. Mô tả mới (vẫn tiếng Trung, 380 byte) nêu rõ:
- gọi khi target là Web site/ứng dụng (SPA, trang quản trị, portal, trang đăng nhập);
- skill thu thập được những gì;
- ưu tiên dùng khi phát hiện cổng web (80/443/8080).

Loader skill (`norma`) cắt mô tả ở **500 byte**, mà mỗi ký tự tiếng Trung chiếm 3 byte, nên mô tả nên dưới khoảng 160 ký tự tiếng Trung.

### Vá các đường lách intercept (rule kiểm soát hành vi agent)

Rà soát cơ chế intercept (`guard/`, `intercept/`) tìm ra các đường mà tool call của agent đi vòng qua rule. Đã vá các đường sau. Các thay đổi chỉ làm rule áp dụng đúng chỗ, **không thêm hay bớt rule nào**, nên không ảnh hưởng khả năng tìm lỗ hổng.

| # | Đường lách | Cách vá | File |
|---|---|---|---|
| 1 | **Planner và Main agent** có `Bash`/`Write`/`Edit`/`WebFetch`/`shell_open` nhưng session không gắn hook intercept | Gắn guard của task (`SetHooks`), kèm thông tin task để bản ghi intercept hiện đúng task | `agent/planner.go`, `agent/mainagent.go`, `server/task_llm.go`, `server/engine.go` (`taskGuardHooks`) |
| 2 | **Escape JSON:** với format OpenAI, chuỗi `arguments` model sinh ra được chuyển nguyên văn, nên một escape kiểu `\u0065` (chữ "e") che được từ khoá khỏi rule trong khi tool vẫn nhận chuỗi đã giải mã | Rule `tool_input` so khớp trên cả input gốc lẫn bản JSON đã chuẩn hoá (giải mã rồi mã hoá lại, không escape HTML) | `intercept/intercept.go` (`canonicalInput`, `ruleMatches`) |
| 3 | **Custom tool** loại `command`/`script`/`http` chạy Bash, Python hoặc HTTP trực tiếp; tên tool không nằm trong danh sách intercept | Trước khi thực thi, đánh giá intercept như một lệnh `Bash` tương đương: lệnh đã render; script dạng `python3 - <<'PY'…`; request HTTP dạng `curl -X … -d …`. Thêm `Guard.Evaluate` | `server/customtool.go`, `guard/guard.go` |
| 4 | **Tool MCP** (`mcp__*`: trình duyệt, ScopeSentry…) không có trong danh sách intercept và không chọn được trên UI | `IsToolEnabled` luôn trả về true cho tool có tiền tố `mcp__` | `intercept/intercept.go` |
| 5 | **Fail-open:** không tải được rule thì coi như không có rule, cho qua; không đọc được cấu hình tool thì coi như không intercept tool nào | Không tải được rule thì `deny` (fail-closed); không đọc được cấu hình tool thì dùng danh sách mặc định; regex hỏng (chỉ có thể do sửa DB trực tiếp) được ghi log. Kiểm tra regex khi lưu rule qua API đã có sẵn | `intercept/intercept.go` |

**Bộ rule chính sách 3 tiêu chí (seed tự động, migration `intercept_policy_rules_v4`):**
- **3 tiêu chí:** không brute-force OTP/tài khoản; không đổi/reset mật khẩu hệ thống/user; không xoá file/thư mục hệ thống (được xoá file do agent tự tạo).
- **Nơi lưu:** 11 rule `[Policy] …` nằm trong `db/policy_rules.json`, được embed vào binary (`db/policy_rules.go`).
- **Khi khởi động:** server tự thêm các rule còn thiếu (theo tên). Nó cũng tắt `[Built-in] Recursive force delete rm -rf` và `[Built-in] Delete critical system directories`, và thu hẹp phần `rm` của `[Built-in] Destructive system commands` về đúng `/`. Ba rule mặc định này **chỉ** bị chỉnh khi còn đúng pattern gốc, rule đã bị người vận hành sửa thì không động vào.
- **Kiểm thử:** 57 ca nên chặn/nên cho qua trong `db/policy_rules_test.go` (`TestPolicyRulesBehaviour`). Hướng dẫn chi tiết ở [docs/intercept-policy-rules.md](docs/intercept-policy-rules.md).
- Mọi rule bật/tắt/sửa được trên **System → Intercept rules**.
- **Migration v5 (`intercept_policy_rules_v5`, `db/policy_rules_v5.go`):** thu hẹp `[Policy] OTP brute-force loop`.
  - **Vấn đề:** bản v4 ghép từ khoá OTP với *mọi* vòng lặp. Khi chạy thật, nó chặn nhầm 2 script dò endpoint: danh sách đường dẫn có `/api/otp`, lặp `curl` qua từng đường dẫn.
  - **Sửa:** bản mới chỉ chặn khi có từ khoá OTP **kèm bộ sinh dãy số lớn** (`seq 0 999999`, `range(1000000)`, `{0000..9999}`, `itertools.product`, `%06d`/`{i:06}`/`zfill(6)`, `crunch`).
  - **Áp dụng:** chỉ cập nhật khi rule còn đúng pattern v4.
  - **Kiểm chứng:** 2 input thật bị chặn nhầm giờ được cho qua.
- **Migration v6 (`intercept_policy_rules_v6`, `db/policy_rules_v6.go`):** xử lý ranh giới dòng lệnh. Trong input JSON, xuống dòng là 2 ký tự `\n`, gây ra 2 lỗi:
  - Rule `rm` có thể khớp **vượt sang dòng sau** (vd. `rm -f $COOKIE_JAR` rồi dòng `curl … -o /dev/null`). Sửa: đoạn giữa không vượt qua dấu `\`.
  - Lệnh ở **đầu một dòng mới** không bị bắt, vì ký tự trước nó là `n` nên `\b` không khớp (vd. `cd /tmp` xuống dòng `rm -rf /etc/x` lọt qua). Sửa: rule `rm`, `find -delete` và SQL đổi mật khẩu được phép bắt đầu ngay sau `\n`.
  - Chỉ cập nhật khi rule còn đúng pattern trước đó. Bộ test lên 57 ca.
- **Migration v7 (`intercept_builtin_rules_v7`, `db/policy_rules_v7.go`):** rule mặc định `[Built-in] Shutdown / reboot` và nhánh `shutdown|reboot` của `[Built-in] Destructive system commands` khớp chữ trần, nên chặn nhầm vòng lặp GET dò endpoint (`/actuator/<word>`). Giờ chỉ chặn lệnh ở vị trí lệnh, lệnh gọi từ code, và POST tới `/shutdown`. Test `TestBuiltinShutdownRulesV7`.
- **Lưu ý khi chỉnh tay:** 2 rule mặc định `[Built-in] Recursive force delete rm -rf` và `[Built-in] Delete critical system directories` chặn rộng hơn tiêu chí 3.
  - Rule thứ hai còn mắc đúng lỗi vượt dòng ở trên. Khi chạy thật, nó chặn agent xoá file cookie tạm của chính agent.
  - v4 tắt sẵn 2 rule này. Nếu bật lại thì agent sẽ không dọn được file tạm của chính nó.

**Chưa thay đổi (theo quyết định của chủ dự án):**
- **LLM judge** giữ nguyên trạng thái tắt.
- **Agent Auto** tạo tool/MCP/skill **không** bắt buộc người duyệt, vì server chạy 24/7 không có người canh.

**Giới hạn còn lại:**
- Rule regex là danh sách đen nên chỉ là lớp phụ; lệnh có thể được viết theo nhiều cách tương đương.
- Rule chặn theo asset (Asset intercept) chỉ được kiểm khi tạo intent / thêm asset, không kiểm lúc chạy lệnh.
- Kiểm soát chính cho mạng nội bộ vẫn là firewall egress dạng allowlist và chạy ARTEX trong container ít quyền.

## 3. Ảnh hưởng vận hành (cần thông báo cho người dùng)

- **Cài mới:** lấy setup token trước khi mở `/setup`:
  - Docker: `docker compose logs artex | grep "setup token"` hoặc `docker compose exec artex cat /app/setup.token`
  - Chạy binary: file `setup.token` nằm cạnh file thực thi.
  - Tự động hoá: đặt sẵn env `ARTEX_SETUP_TOKEN`.
- **Chạy dev (`next dev`)** từ origin khác `localhost:3000/5173`: set `ARTEX_CORS_ORIGINS=http://<host>:<port>`.
- Client/script bên ngoài từng gọi API bằng cookie hoặc `?token=` phải chuyển sang header `Authorization: Bearer <jwt>`.
- Đổi mật khẩu sẽ đăng xuất mọi phiên khác.

## 4. Kiểm thử đã chạy

- `go build ./...` và `go vet ./...`: pass. `npx tsc --noEmit`: pass. `node --test src/lib/*.test.mjs`: pass (7/7).
- `go test -p 1 ./...` với Postgres 16 tạm: không có test nào fail mới so với baseline của bản gốc.
  - Các failure còn lại đều có sẵn: lỗi đường dẫn/quyền file trên Windows (`evidence`, `finding_traffic`, `TestSkillRelPath`…), cùng `TestCompanyScopeAttribution` vốn phụ thuộc trạng thái DB và cũng fail trên bản gốc.
  - Các test kỳ vọng chuỗi tiếng Trung đã được cập nhật theo chuỗi tiếng Anh mới.
- Biome lint: số lỗi bằng bản gốc (83).
- Sau khi nâng thư viện: `go test` không có test nào fail mới. `TestMgmtAPI` fail một lần do Windows chưa xoá được thư mục tạm lúc dọn dẹp, cùng loại flaky với `TestTaskMetadataPatch…` ở baseline (test đó lần này pass). `tsc` pass, `next build` (static export) pass.
- Đã kiểm tra trên trình duyệt với bản build có nhúng UI (`-tags embedui`):
  - Trang Setup đòi setup token: token sai bị từ chối với thông báo tiếng Anh, token đúng thì vào được ứng dụng.
  - Các trang Dashboard, Logs, Settings không còn chữ Trung.
  - Header `X-Frame-Options: DENY` và `CSP frame-ancestors 'none'` có mặt.
