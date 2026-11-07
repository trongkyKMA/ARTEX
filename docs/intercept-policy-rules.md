# Intercept rules cho chính sách 3 tiêu chí

Bộ rule này thực thi 3 hành vi bị cấm khi ARTEX chạy trong mạng nội bộ:

1. **Không brute-force** tài khoản người dùng hoặc mã OTP.
2. **Không đổi/reset mật khẩu** của hệ thống hoặc người dùng.
3. **Không xoá file/thư mục hệ thống.** Agent vẫn được xoá file do chính nó tạo: đường dẫn tương đối trong thư mục làm việc của task, `/tmp`, `/var/tmp`, `/dev/shm`.

Rule chỉ chặn đúng hành vi bị cấm, **không chặn kỹ thuật kiểm thử**. Các thao tác sau vẫn được phép:
- Thử vài mật khẩu mặc định bằng tay.
- Quét thư mục bằng `ffuf`/`gobuster`.
- `sqlmap`, `nmap -sV`, đọc file (`cat /etc/passwd`, path traversal).
- Crack hash offline bằng `hashcat`/`john`.
- Gửi một request OTP; trinh sát (GET) trang reset mật khẩu.

Toàn bộ rule đã được chạy thử bằng engine regex RE2 của Go (đúng engine ARTEX dùng), trên input JSON y hệt dạng interceptor nhận được. Kết quả **57/57 ca đúng** (xem phần cuối).

## Rule được cài tự động

**Từ phiên bản này không cần nhập tay.**
- **Cách hoạt động:** khi ARTEX khởi động, migration `intercept_policy_rules_v4` (`db/policy_rules.go`) tự thêm 11 rule `[Policy] …` lấy từ `db/policy_rules.json`, và tự chỉnh 3 rule mặc định (xem mục "Chỉnh 3 rule mặc định" bên dưới).
- **Chạy một lần:** migration chạy đúng **một lần cho mỗi database**. Cờ của nó là `intercept_policy_rules_v4 = done` trong bảng `settings`.
- **Không ghi đè thay đổi của anh:** rule nào đã có (trùng tên) thì bỏ qua. Rule mặc định nào anh đã sửa thì không bị đụng tới.
- **Kiểm tra:** vào **System → Intercept rules**, phải thấy 11 rule tên bắt đầu bằng `[Policy]`, đang bật.
- **Bật/tắt/sửa/xoá:** làm trực tiếp trên trang đó, có hiệu lực ngay.
- **Đổi bộ rule cho cài mới:** sửa `db/policy_rules.json`, chạy `go test ./db/ -run TestPolicyRulesBehaviour` (57 ca), rồi build lại.
  - Với DB đã cài, sửa trên UI. Migration không chạy lại.
  - Nếu xoá rule trên UI rồi muốn cài lại, xoá dòng `intercept_policy_rules_v4` trong bảng `settings` rồi khởi động lại server.
- **Ghi thẳng vào DB** (không qua UI/API): server giữ rule trong bộ nhớ đệm. Gạt tắt rồi bật lại một rule bất kỳ trên UI để server nạp lại.

## Cách thêm tay trên giao diện (khi cần tạo lại hoặc thêm rule tương tự)

**System → Intercept rules → New rule**, nhập từng rule bên dưới:
- **Match target:** `tool_input`
- **Match type:** `regex`
- **Action:** `deny`
- **Priority:** `95`, cao hơn các rule cho phép, thấp hơn rule thảm hoạ mặc định (100)
- **Timeout:** tắt. Rule `deny` không chờ người duyệt, nên phù hợp với server chạy 24/7.
- **Pattern:** dán **nguyên văn** nội dung trong khung code, không thêm khoảng trắng ở đầu/cuối.

Rule có hiệu lực ngay khi lưu. Rule áp dụng cho mọi tool nằm trong danh sách intercept:
- `Bash`, `shell_open`/`shell_send`, `Write`/`Edit`/`MultiEdit`, `WebFetch`, `web_search`;
- tool MCP `mcp__*`;
- custom tool loại command/script/http (đi qua intercept dưới dạng `Bash`).

Phạm vi agent: Worker, Planner, Main và các chat agent.

## Rule mới (11 rule)

### 1. [Policy] Credential brute-force tools

| Field | Value |
|---|---|
| Match target | `tool_input` |
| Match type | `regex` |
| Action | `deny` |
| Priority | `95` |

Pattern:

```
(?i)(?:^|[\s;&|"'(\x60]|\\n)(?:hydra|xhydra|medusa|ncrack|patator|crowbar|brutespray|kerbrute|legba)\s
```

### 2. [Policy] Brute-force scripts/modules (nmap, Metasploit)

| Field | Value |
|---|---|
| Match target | `tool_input` |
| Match type | `regex` |
| Action | `deny` |
| Priority | `95` |

Pattern:

```
(?i)\bnmap\b[^\n]{0,300}--script[= ]?[^\s"]{0,60}brute|auxiliary/scanner/[\w/]{0,80}_login\b
```

### 3. [Policy] Password wordlist against a network target

| Field | Value |
|---|---|
| Match target | `tool_input` |
| Match type | `regex` |
| Action | `deny` |
| Priority | `95` |

Pattern:

```
(?i)(?:rockyou|passwords?\.(?:txt|lst)|pass(?:word)?list|seclists/passwords|\.dic\b)[\s\S]{0,400}?(?:https?://|\bcurl\b|\bwget\b|\bssh\b|\bftp\b|\bsmb|\bldap|\brdp\b|requests\.|httpx|\bnxc\b|netexec|crackmapexec)|(?:https?://|\bcurl\b|\bwget\b|requests\.|httpx|\bnxc\b|netexec|crackmapexec)[\s\S]{0,400}?(?:rockyou|passwords?\.(?:txt|lst)|pass(?:word)?list|seclists/passwords|\.dic\b)
```

### 4. [Policy] Fuzzing password/OTP fields

| Field | Value |
|---|---|
| Match target | `tool_input` |
| Match type | `regex` |
| Action | `deny` |
| Priority | `95` |

Pattern:

```
(?i)\b(?:ffuf|wfuzz)\b[\s\S]{0,400}?(?:otp|totp|mfa|2fa|code|pass(?:word|wd)?|pwd|pin)\\?["']?\s*[:=]\s*\\?["']?FUZZ
```

### 5. [Policy] OTP brute-force loop

| Field | Value |
|---|---|
| Match target | `tool_input` |
| Match type | `regex` |
| Action | `deny` |
| Priority | `95` |

Pattern:

```
(?i)(?:^|[^a-z0-9])(?:otp|totp|2fa|mfa|sms_?code|verify_?code|verification_?code|one.?time)(?:[^a-z0-9]|$)[\s\S]{0,500}?(?:\bseq\s+(?:-[a-z]+\s+)*(?:\d+\s+)?\d{3,}|range\s*\(\s*(?:\d+\s*,\s*)?\d{3,}|\{\d+\.\.\d{3,}\}|itertools\.product|%0[4-9]d|\{\w*:0[4-9]d?\}|\.zfill\(\s*[4-9]|\bcrunch\s+[4-9])|(?:\bseq\s+(?:-[a-z]+\s+)*(?:\d+\s+)?\d{3,}|range\s*\(\s*(?:\d+\s*,\s*)?\d{3,}|\{\d+\.\.\d{3,}\}|itertools\.product|%0[4-9]d|\{\w*:0[4-9]d?\}|\.zfill\(\s*[4-9]|\bcrunch\s+[4-9])[\s\S]{0,500}?(?:^|[^a-z0-9])(?:otp|totp|2fa|mfa|sms_?code|verify_?code|verification_?code|one.?time)(?:[^a-z0-9]|$)
```

### 6. [Policy] Change password - OS commands

| Field | Value |
|---|---|
| Match target | `tool_input` |
| Match type | `regex` |
| Action | `deny` |
| Priority | `95` |

Pattern:

```
(?i)(?:^|"command"\s*:\s*"|"text"\s*:\s*"|[;&|]|\\n|\bsudo\s|\$\(|\x60)\s*(?:passwd|chpasswd|smbpasswd|ldappasswd|kpasswd|chage)\b|\busermod\b[^\n;&|]{0,100}\s(?:-p|--password)\s|\bnet\s+user\s+[^\s/"\\]+\s+[^\s/"\\]+|Set-ADAccountPassword|Set-LocalUser[^\n]{0,100}-Password|\bdsmod\s+user[^\n]{0,200}-pwd
```

### 7. [Policy] Change password - SQL

| Field | Value |
|---|---|
| Match target | `tool_input` |
| Match type | `regex` |
| Action | `deny` |
| Priority | `95` |

Pattern:

```
(?i)(?:\b|\\n)ALTER\s+(?:USER|LOGIN|ROLE)\b[^;\n]{0,200}\b(?:PASSWORD|IDENTIFIED)\b|(?:\b|\\n)SET\s+PASSWORD\b|\bsp_password\b|(?:\b|\\n)UPDATE\s+[\w.\x60"\[\]\\]*(?:user|account|member|admin|login)\w*[\x60"\]\\]*\s+SET\s+[^;\n]{0,200}?(?:pass(?:word|wd)?|pwd|hash)\w*[\x60"\]\\]*\s*=
```

### 8. [Policy] Change password - HTTP request

| Field | Value |
|---|---|
| Match target | `tool_input` |
| Match type | `regex` |
| Action | `deny` |
| Priority | `95` |

Pattern:

```
(?i)(?:\bcurl\b|\bwget\b|requests\.|httpx\.|aiohttp|fetch\()[\s\S]{0,600}?(?:(?:new|confirm)[_-]?(?:pass(?:word|wd)?|pwd)\b|(?:change|reset|update|modify)[_-]?(?:pass(?:word|wd)?|pwd)[\s\S]{0,300}?(?:\s-d\b|--data|--json|\s-F\b|json\s*=|data\s*=))
```

### 9. [Policy] Delete system files/dirs (rm/rmdir/unlink/shred)

| Field | Value |
|---|---|
| Match target | `tool_input` |
| Match type | `regex` |
| Action | `deny` |
| Priority | `95` |

Pattern:

```
(?i)(?:\b|\\n)(?:rm|rmdir|unlink|shred|srm)\b[^\n;&|\\]{0,200}?(?:\s|\\?["'=])(?:/(?:etc|bin|sbin|usr|boot|lib|lib32|lib64|opt|srv|root|home|proc|sys|mnt|media|snap|run|var/(?:www|lib|log|spool|mail|opt|backups|cache|db|local))(?:/|\s|\\?["';&|*]|$)|/(?:var|app)(?:\s|\\?["';&|*]|$)|/app/(?:artex|skills|start\.sh)|/(?:\s|\\?["';&|*]|$)|~(?:/|\s|\\?["';&|]|$)|\.\./)
```

### 10. [Policy] Delete system files/dirs (find -delete)

| Field | Value |
|---|---|
| Match target | `tool_input` |
| Match type | `regex` |
| Action | `deny` |
| Priority | `95` |

Pattern:

```
(?i)(?:\b|\\n)find\s+\\?["']?(?:/(?:etc|bin|sbin|usr|boot|lib|lib64|opt|srv|root|home|var/(?:www|lib|log)|app)\b|/(?:\s|\\?["']))[^\n;&|]{0,200}(?:-delete|-exec\s+(?:rm|shred|unlink))
```

### 11. [Policy] Delete system files/dirs (Python/Node APIs)

| Field | Value |
|---|---|
| Match target | `tool_input` |
| Match type | `regex` |
| Action | `deny` |
| Priority | `95` |

Pattern:

```
(?i)(?:os\.(?:remove|unlink|rmdir|removedirs)|shutil\.rmtree|\.(?:unlink|unlinkSync|rm|rmSync|rmdir|rmdirSync)\()\s*\(?\s*\\?["'](?:/(?:etc|bin|sbin|usr|boot|lib|lib64|opt|srv|root|home|var/(?:www|lib|log)|app)\b|/\\?["'])
```

## Chỉnh 3 rule mặc định đang chặn quá rộng

Ba rule mặc định của bản gốc chặn cả việc agent dọn file của chính nó, trái với tiêu chí 3. Đã kiểm chứng: `rm -rf ./out`, `rm -f /tmp/x`, `rm -rf /var/tmp/x` đều bị chặn. Các rule mới ở trên đã thay thế phần việc của chúng. Migration v4 **tự làm** các thay đổi dưới đây (chỉ khi rule còn nguyên bản gốc). Bảng này để anh tự kiểm tra hoặc làm tay nếu cần:

| Rule mặc định | Việc cần làm | Lý do |
|---|---|---|
| `[Built-in] Recursive force delete rm -rf` | **Tắt** (Enabled = off) | Chặn mọi `rm -rf`, kể cả trong thư mục làm việc |
| `[Built-in] Delete critical system directories` | **Tắt** | Nhánh `(/|…)` khớp **mọi** đường dẫn tuyệt đối, kể cả `/tmp` |
| `[Built-in] Destructive system commands` | **Sửa pattern** như dưới | Đoạn `rm\s+-rf\s+/` khớp cả `/tmp/...`; chỉ nên chặn đúng thư mục gốc `/` |

Pattern hiện tại của `[Built-in] Destructive system commands` (từ v7; giữ mkfs, dd, fork bomb, ghi đè đĩa; phần shutdown/reboot chuyển sang rule `[Built-in] Shutdown / reboot` bản thu hẹp):

```
(?i)\b(rm\s+-rf\s+/(?:\s|\*|\\?["']|$)|mkfs|dd\s+if=|:\(\)\s*\{|>\s*/dev/sd)
```

**Migration v7, rule `[Built-in] Shutdown / reboot`:** pattern gốc `\b(?:shutdown|reboot|halt|poweroff|init\s+[06])\b` khớp chữ `shutdown` ở bất kỳ đâu. Khi chạy thật, nó chặn nhầm một vòng lặp **GET** dò endpoint có chữ "shutdown" trong danh sách. v7 thu hẹp rule này, chỉ chặn khi:
- `shutdown`/`reboot`/`halt`/`poweroff`/`init 0|6` nằm **ở vị trí lệnh**, hoặc `systemctl reboot|poweroff|halt`;
- lệnh đó được gọi từ code: `os.system("reboot")`, `subprocess.run(["shutdown", …])`;
- có request **POST tới đường dẫn `/shutdown`** (vd. `/actuator/shutdown`, thực sự tắt ứng dụng). Gọi GET thì cho qua.

Chỉ áp dụng khi rule còn pattern gốc. Test: `TestBuiltinShutdownRulesV7` (20 ca).

Các rule mặc định khác giữ nguyên: HTTP `DELETE`, SQL `DROP`/`TRUNCATE`, Redis `FLUSHALL`, `mkfs`, `dd`, `shutdown`…

## Kết quả kiểm thử (57/57)

| Tiêu chí | Bị chặn (đúng) | Được phép (đúng) |
|---|---|---|
| 1. Brute-force | `hydra …`, `medusa …`, `nmap --script ssh-brute`, Metasploit `*_login`, `nxc … -p rockyou.txt`, `ffuf` vào trường `password=FUZZ` hoặc `otp=FUZZ`, vòng `seq 0 999999` gửi OTP, script Python `range(1000000)` gửi `code`, vòng `while read p` với `passwords.txt` | Một lần đăng nhập `admin/admin`, `ffuf -u …/FUZZ -w common.txt`, `hashcat … rockyou.txt`, `nmap -sV -p-`, một request gửi OTP, chuỗi hex chứa `2fa` |
| 2. Đổi mật khẩu | `passwd root`, `… \| chpasswd`, `usermod -p`, `net user admin <pass>`, `ALTER USER … IDENTIFIED BY`, `UPDATE users SET password_hash=…`, `curl` POST `newPassword`, `curl` POST `/reset-password --data` | `cat /etc/passwd`, `grep passwd config.php`, `curl` GET `/reset-password`, `net user admin /domain`, `sqlmap --dbs`, `SELECT user, password FROM …` |
| 3. Xoá file hệ thống | `rm -rf /var/www/html`, `rm /etc/hosts`, `rm -rf /`, `rm -rf ~`, `rm -rf ../../..`, `rm -f /app/artex`, `find /var/log … -delete`, `shutil.rmtree('/etc/nginx')`, Node `rmSync('/home/app')` | `rm -rf ./out`, `rm -f /tmp/x`, `rm -rf /var/tmp/x`, `rm -f /dev/shm/x`, `os.remove('result.json')`, path traversal đọc `../../etc/passwd` |

## Giới hạn cần biết

- **Regex không bắt hết mọi cách viết lệnh.** Ví dụ: tách lệnh bằng dấu nháy (`r''m`), mã hoá base64 rồi `| sh`, hoặc script tự viết đặt tên biến lạ. Đây là lớp chặn nhanh. Lớp nền tảng vẫn là **Constraints** của task (agent tự tuân thủ) cộng với giới hạn mạng/sandbox.
- **Đổi mật khẩu qua trình duyệt** (MCP browser điền form) không có `curl`/`requests` nên rule HTTP không bắt được. Nếu dùng MCP browser cho Worker, cân nhắc bật LLM judge.
- **Một số tình huống có thể bị chặn nhầm:**
  - `curl` tải một file tên `passwords.txt` từ target (khi khai thác path traversal). Có thể đổi cách gọi, hoặc tạm tắt rule "Password wordlist against a network target".
  - Lệnh xoá một đường dẫn tuyệt đối trong `/home/...` khi ARTEX chạy trực tiếp trên host (không qua Docker) và thư mục làm việc nằm trong `/home`. Khi chạy bằng Docker (`/app/data/...`) thì không bị ảnh hưởng.
- File `db/policy_rules.json` chứa đúng 11 rule này, dạng JSON khớp với API `POST /api/intercept/rules`. Đây cũng là nguồn mà migration v4 dùng.
