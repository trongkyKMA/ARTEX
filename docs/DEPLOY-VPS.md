# Triển khai ARTEX lên VPS (từng bước)

Checklist triển khai bản fork `trongkyKMA/ARTEX` lên một VPS Linux, chạy 24/7. Gom từ hướng dẫn của repo cũ `ARTEX-en` (README, SECURITY, compose) và [HUONG-DAN.md](HUONG-DAN.md), điều chỉnh theo repo này. Chi tiết từng tính năng (LLM, skill, intercept, task) vẫn ở HUONG-DAN; tài liệu này chỉ lo phần **đưa lên server và vận hành an toàn**.

> **Nguyên tắc:** ARTEX điều khiển agent chạy lệnh thật tới target. Giao diện web (cổng 8787) **không bao giờ mở thẳng ra Internet**. Trên VPS, chỉ truy cập qua SSH tunnel hoặc reverse proxy HTTPS có giới hạn IP.

**Mục lục**
0. [Chuẩn bị](#0-chuẩn-bị)
1. [Chuẩn bị VPS](#1-chuẩn-bị-vps)
2. [Lấy code](#2-lấy-code)
3. [Có image Docker: chọn 1 trong 3 cách](#3-có-image-docker-chọn-1-trong-3-cách)
4. [Cấu hình `.env`](#4-cấu-hình-env)
5. [Khởi động và setup lần đầu](#5-khởi-động-và-setup-lần-đầu)
6. [Kiểm tra sau khi cài](#6-kiểm-tra-sau-khi-cài)
7. [Truy cập lâu dài: SSH tunnel hoặc HTTPS](#7-truy-cập-lâu-dài-ssh-tunnel-hoặc-https)
8. [Kết nối Claude Code (MCP) từ laptop](#8-kết-nối-claude-code-mcp-từ-laptop)
9. [Backup tự động](#9-backup-tự-động)
10. [Cập nhật phiên bản](#10-cập-nhật-phiên-bản)
11. [Bảo mật và tuân thủ](#11-bảo-mật-và-tuân-thủ)
12. [Sự cố thường gặp trên VPS](#12-sự-cố-thường-gặp-trên-vps)

---

## 0. Chuẩn bị

| Hạng mục | Yêu cầu |
|---|---|
| VPS | Ubuntu 22.04/24.04 LTS, x86_64 (arm64 cũng được). **≥ 4 vCPU, 8 GB RAM, 40 GB SSD** (tối thiểu 2 vCPU / 4 GB nếu không build trên VPS) |
| Mạng ra | VPS phải tới được **target trong phạm vi** và **API LLM** (DeepSeek/GLM/…) |
| SOC / WAF | Báo trước IP public của VPS để whitelist. ARTEX không gắn dấu hiệu riêng vào request, nên phía target chỉ nhận ra qua IP nguồn |
| Quyền repo | Tài khoản GitHub là collaborator của repo private `trongkyKMA/ARTEX` |
| LLM | API key của nhà cung cấp, nhập trên giao diện sau khi cài |

---

## 1. Chuẩn bị VPS

```bash
# Cập nhật hệ thống, tạo user vận hành (không chạy ARTEX bằng root qua SSH)
sudo apt update && sudo apt -y upgrade
sudo adduser artex && sudo usermod -aG sudo artex
# Đăng nhập SSH bằng key, rồi tắt đăng nhập bằng mật khẩu:
#   /etc/ssh/sshd_config → PasswordAuthentication no, PermitRootLogin no → sudo systemctl restart ssh

# Firewall: chỉ mở SSH (và 443 nếu dùng HTTPS ở §7)
sudo ufw allow OpenSSH
sudo ufw enable

# Docker + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker artex      # đăng xuất / đăng nhập lại để có hiệu lực
docker compose version

# Swap 4 GB, tránh hết RAM khi build hoặc khi Chromium chạy
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

> ⚠️ **Docker bỏ qua UFW** với các cổng được publish. Nếu để `ARTEX_BIND=0.0.0.0`, cổng 8787 sẽ mở ra Internet **dù UFW chặn**. Vì vậy trên VPS luôn đặt `ARTEX_BIND=127.0.0.1` (§4).

---

## 2. Lấy code

```bash
sudo apt -y install git gh
gh auth login                      # chọn GitHub.com → HTTPS → login bằng trình duyệt hoặc token
git clone https://github.com/trongkyKMA/ARTEX.git ~/ARTEX
cd ~/ARTEX
```

Không muốn đăng nhập tài khoản cá nhân trên VPS thì dùng **deploy key** chỉ đọc (repo → Settings → Deploy keys) và clone bằng SSH.

---

## 3. Có image Docker: chọn 1 trong 3 cách

| Cách | Khi nào dùng | Trên VPS cần |
|---|---|---|
| **A. Build trên VPS** | Đơn giản nhất, luôn đúng code đang checkout | Chỉ Docker |
| **B. Image từ GHCR** | Dùng bản đã phát hành, không build | Docker + token `read:packages` |
| **C. Build trên laptop, chép sang** | VPS yếu hoặc không ra được Internet để tải thư viện | Docker |

### A. Build trên VPS (cài một lệnh)

```bash
cd ~/ARTEX && ./install.sh     # chọn 1) Full Docker install
```

- Script tự làm các bước: tạo `.env` (§4), hỏi chế độ truy cập (chọn **1 = chỉ máy này**), build image, khởi động, rồi in **setup token** và lệnh SSH tunnel. Sau đó chuyển thẳng sang §5 phần mở `/setup`.
- Không cần cài Go hay Node.js: nếu VPS không có, giao diện và binary được build trong container tạm. Lần đầu mất 10–20 phút, vì phải tải image node, golang và build image runtime.
- Muốn tự làm từng bước: sửa `.env` theo §4, rồi chạy `./docker-build.sh`.

### B. Image từ GHCR

Image chỉ có khi đã **gắn tag phát hành** (`git tag v1.0.x && git push origin v1.0.x`, xem HUONG-DAN §11). Chọn tag **mới nhất**: bản cũ không có các bản sửa phát hành sau đó.

```bash
echo "<token có quyền read:packages>" | docker login ghcr.io -u <github-username> --password-stdin
# Trong .env (§4):  ARTEX_IMAGE=ghcr.io/trongkykma/artex   ARTEX_TAG=v1.0.x
docker compose pull artex
```

### C. Build trên laptop rồi chép sang

```bash
# Trên laptop (có Docker), trong thư mục repo:
./docker-build.sh                                   # VPS arm64 thì thêm ARTEX_ARCH=arm64
docker save artex-local:latest | gzip | ssh artex@<vps> 'gunzip | docker load'
```

> 🚫 **Không dùng image dựng sẵn của upstream** (`autumn27/artex`, `tomicdd/artex` hay image lạ khác). Image `tomicdd/artex` đã được xác nhận **có backdoor**: chạy lệnh không cần đăng nhập qua form login. Image `autumn27/artex` chưa được kiểm chứng và không có các bản sửa của fork này. Chỉ chạy image build từ source repo này (A, C) hoặc từ CI của repo này (B). Xử lý nếu đã lỡ chạy: xem §11.

---

## 4. Cấu hình `.env`

```bash
cd ~/ARTEX
cp .env.example .env && chmod 600 .env
openssl rand -hex 24          # dùng làm POSTGRES_PASSWORD
openssl rand -hex 16          # (tuỳ chọn) dùng làm ARTEX_SETUP_TOKEN
nano .env
```

Giá trị nên đặt trên VPS:

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `POSTGRES_PASSWORD` | chuỗi ngẫu nhiên ở trên | Bắt buộc. Đổi sau khi DB đã tạo thì phải đổi cả trong Postgres |
| `ARTEX_BIND` | **`127.0.0.1`** | Bắt buộc trên VPS (xem cảnh báo UFW ở §1) |
| `ARTEX_HTTP_PORT` | `8787` | |
| `ARTEX_PROXY_PORT` | `8788` | Proxy ghi traffic, luôn chỉ ở loopback |
| `ARTEX_IMAGE` / `ARTEX_TAG` | `artex-local` / `latest` (cách A, C) hoặc GHCR (cách B) | |
| `ARTEX_SETUP_TOKEN` | để trống hoặc chuỗi ngẫu nhiên | Token dùng một lần cho `/setup` |
| `ARTEX_CORS_ORIGINS` | **để trống** | |
| `ARTEX_UPDATE_GITHUB_TOKEN` | để trống | Chỉ cần khi chạy binary có tag và muốn dùng nút Update (HUONG-DAN §11) |
| `*_API_KEY`, `ARTEX_LLM_*` | để trống | Nên cấu hình LLM trên giao diện (System → LLM) |

---

## 5. Khởi động và setup lần đầu

```bash
cd ~/ARTEX
docker compose up -d
docker compose ps                         # artex: Up, postgres: healthy
docker compose logs --tail 50 artex       # không có dòng lỗi / panic
docker compose exec artex cat /app/keys/setup.token
```

Mở giao diện qua **SSH tunnel** từ laptop. Làm setup qua tunnel để không ai khác giành được quyền admin trước:

```bash
ssh -N -L 8787:127.0.0.1:8787 artex@<vps>
# Trình duyệt laptop: http://127.0.0.1:8787/setup → nhập setup token → đặt mật khẩu admin (username luôn là ARTEX)
```

Sau đó làm theo HUONG-DAN:
- §6: tạo LLM profile và gán model cho Planner/Worker.
- §7: kiểm tra skill đã bật cho agent.
- §8: rà bộ rule intercept chính sách.
- §9: tạo task với goal và constraint rõ phạm vi.

---

## 6. Kiểm tra sau khi cài

```bash
cd ~/ARTEX
curl -s http://127.0.0.1:8787/api/health; echo                    # {"ok":true,...}
docker compose exec artex sh -c 'echo CHROMIUM=$CHROMIUM; /usr/bin/chromium --version'
docker compose exec artex sh -c 'playwright-cli open https://example.com && playwright-cli snapshot | head -5; playwright-cli close'
docker compose exec artex sh -c 'nmap --version | head -1; curl --version | head -1'
docker compose logs artex | grep -E "key directory|recording proxy|listening"
ls -l keys/                                                         # có jwt.key (và setup.token trước khi setup)
```

Trên giao diện:
- **Intercept → Rules:** có các rule `[Policy]` và `[Built-in]` đang bật.
- **System → Skill:** `api-recon` và `playwright-cli` bật cho Worker/Pentest.
- **Traffic:** sau khi task chạy có request được ghi lại.
- Thử một task nhỏ trên target lab trong phạm vi, xem có finding, report tiếng Anh và traffic bằng chứng.

Thử tính bền vững: `docker compose up -d --force-recreate artex`, rồi tải lại trang. Vẫn đăng nhập được, không bị bắt đăng nhập lại, nghĩa là khoá JWT trong `./keys` được giữ.

---

## 7. Truy cập lâu dài: SSH tunnel hoặc HTTPS

**Cách 1: SSH tunnel** (khuyến nghị cho 1 người hoặc nhóm nhỏ). Không mở thêm cổng nào. Mỗi lần dùng:

```bash
ssh -N -L 8787:127.0.0.1:8787 artex@<vps>     # rồi mở http://127.0.0.1:8787
```

**Cách 2: Nginx HTTPS** (cho nhiều người dùng). Bắt buộc **giới hạn IP** và **tắt buffering**, vì luồng hoạt động realtime dùng SSE.

```bash
sudo apt -y install nginx certbot python3-certbot-nginx
sudo ufw allow 443/tcp
```

`/etc/nginx/sites-available/artex`:

```nginx
server {
    listen 443 ssl;
    server_name artex.example.com;
    # ssl_certificate / ssl_certificate_key: do certbot điền

    # Chỉ cho phép IP văn phòng / VPN
    allow 203.0.113.10;
    deny  all;

    client_max_body_size 50m;          # upload skill / file vào workspace

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        # SSE: không buffer, timeout dài, HTTP/1.1
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/artex /etc/nginx/sites-enabled/
sudo certbot --nginx -d artex.example.com
sudo nginx -t && sudo systemctl reload nginx
```

Lưu ý:
- Sau reverse proxy, mọi người dùng chung IP của proxy. Giới hạn đăng nhập sai (5 lần / 15 phút) vì vậy áp dụng chung cho cả nhóm.
- **Không** cần đặt `NEXT_PUBLIC_SSE_BASE`: giao diện, API và SSE dùng chung origin.

---

## 8. Kết nối Claude Code (MCP) từ laptop

Adapter MCP chạy **trên laptop** (cần Node ≥ 22) và gọi API của ARTEX trên VPS. Cài đặt và các biến môi trường: xem HUONG-DAN §13. Với VPS:

- **Qua SSH tunnel:** mở `ssh -N -L 8790:127.0.0.1:8787 artex@<vps>`, rồi đặt `SCOPEWEAVER_URL=http://127.0.0.1:8790`.
- **Qua HTTPS (§7, cách 2):** đặt `SCOPEWEAVER_URL=https://artex.example.com`. IP của laptop phải nằm trong `allow`.
- Đặt `SCOPEWEAVER_PASSWORD` bằng mật khẩu admin của **instance trên VPS**, ở biến môi trường của user, không ghi vào file config.
- Adapter từ chối HTTP thường tới máy khác, để mật khẩu và JWT không đi qua mạng dạng rõ.

---

## 9. Backup tự động

Cần backup **cùng lúc** 3 thứ: database, `./data` (traffic, `data/evidence`, workspace) và `./keys` (khoá JWT). Thêm `.env` nếu muốn khôi phục y nguyên.

`~/ARTEX/backup.sh` (tự tạo, không commit):

```bash
#!/usr/bin/env bash
set -euo pipefail
cd ~/ARTEX
DEST=~/artex-backups; mkdir -p "$DEST"; D=$(date +%F)
docker compose exec -T postgres pg_dump -U artex artex | gzip > "$DEST/db-$D.sql.gz"
tar czf "$DEST/files-$D.tgz" --exclude=data/traffic data keys .env   # bỏ --exclude nếu muốn giữ cả traffic thô (lớn); bằng chứng gắn vào finding nằm ở data/evidence, không phụ thuộc data/traffic
find "$DEST" -type f -mtime +14 -delete                   # giữ 14 ngày
```

```bash
chmod 700 ~/ARTEX/backup.sh
(crontab -l 2>/dev/null; echo "30 2 * * * $HOME/ARTEX/backup.sh >> $HOME/artex-backups/backup.log 2>&1") | crontab -
```

Nên chép bản backup ra ngoài VPS. File backup chứa dữ liệu nhạy cảm (finding, evidence, khoá JWT), nên phải mã hoá và giới hạn quyền truy cập.

Khôi phục DB: `gunzip -c db-<ngày>.sql.gz | docker compose exec -T postgres psql -U artex artex`.

---

## 10. Cập nhật phiên bản

```bash
cd ~/ARTEX
./backup.sh                            # luôn backup trước
git pull
./docker-build.sh && docker compose up -d     # cách A
# cách B: sửa ARTEX_TAG trong .env → docker compose pull artex && docker compose up -d
# cách C: build lại trên laptop → docker save … | ssh … docker load → docker compose up -d
docker image prune -f                  # dọn image cũ (tuỳ chọn)
```

- Database **tự migrate** khi khởi động, không cần chạy lệnh gì thêm.
- Tạo lại container sẽ ngắt các intent đang chạy; khi lên lại, chúng được đưa về hàng chờ và chạy lại.
- `./keys` được giữ nên không ai bị đăng xuất.
- Hoặc dùng `./update.sh` (chọn Docker), script tự `git pull` và build lại.

---

## 11. Bảo mật và tuân thủ

- **Cổng:** 8787 chỉ nghe ở `127.0.0.1`; 8788 (proxy ghi traffic) luôn chỉ ở loopback. Kiểm tra bằng `sudo ss -ltnp | grep -E '8787|8788'`: phải thấy `127.0.0.1:…`, không được có `0.0.0.0:…`.
- **Giới hạn mạng ra (egress):** dùng firewall dạng allowlist (`ufw default deny outgoing` + allow tới dải target và API LLM, hoặc security group của nhà cung cấp VPS). Đây là lớp chặn chính; intercept và constraint là lớp phụ.
- **Dữ liệu gửi cho LLM:** nội dung trao đổi của agent (response của target, evidence, finding) được gửi tới nhà cung cấp LLM. Cân nhắc yêu cầu về nơi lưu trữ dữ liệu và chính sách nội bộ (Thông tư 77, PCI-DSS) trước khi chạy trên hệ thống thật. Ưu tiên môi trường UAT/staging và dữ liệu test.
- **Bí mật:** `.env` (mật khẩu DB), `./keys/jwt.key` (ai có file này giả được phiên đăng nhập) và backup đều để quyền `600`/`700`. Không commit, không chép lên chỗ dùng chung.
- **Mật khẩu admin:** dài, ngẫu nhiên. Đổi mật khẩu sẽ đăng xuất mọi phiên khác. Quên mật khẩu: `./reset-password.sh -m docker`.
- **Container chạy root** (giới hạn của bản gốc). Không mount thêm thư mục nhạy cảm của host vào container.

**Nếu đã từng chạy image dựng sẵn không rõ nguồn** (như `tomicdd/artex`): coi máy đó **đã bị xâm nhập**.
1. Cô lập: dừng stack hoặc chặn cổng web. Giữ lại log, `docker export` của container và các volume trước khi xoá.
2. Tìm dấu vết: `POST /api/auth/login` từ IP lạ trong log proxy/firewall; process, kết nối ra ngoài, cron, SSH key lạ; file mới trong `data/` và `skills/`.
3. Tìm cơ chế bám trụ trong DB (tồn tại cả khi đổi image): custom tool, MCP server, LLM profile có base URL lạ, webhook thông báo, rule intercept bị tắt, prompt agent bị sửa.
4. Đổi **mọi** bí mật instance đó từng giữ: API key LLM, token Telegram/webhook, mật khẩu Postgres, mật khẩu admin ARTEX và `jwt.key`, credential target lưu trong finding/note.
5. Cài lại sạch: máy mới hoặc đã xoá trắng, clone mới, `.env` mới, **volume DB mới**. Không chép `data/` hay `skills/` cũ sang.
6. Báo cáo theo quy trình xử lý sự cố nếu instance đó giữ dữ liệu khách hàng hoặc có đường mạng tới môi trường khách hàng.

---

## 12. Sự cố thường gặp trên VPS

| Triệu chứng | Cách xử lý |
|---|---|
| `docker-build.sh` bị kill khi `next build` hoặc `go build` | Hết RAM: thêm swap (§1), hoặc dùng cách C (build trên laptop) |
| `docker compose up` báo không pull được `artex-local` | Chưa build image (cách A/C), hoặc `.env` sai `ARTEX_IMAGE`/`ARTEX_TAG` |
| Pull GHCR báo `denied` | Chưa `docker login ghcr.io`, hoặc token thiếu `read:packages` / không có quyền repo |
| Truy cập được 8787 từ Internet | `ARTEX_BIND` không phải `127.0.0.1` (Docker bỏ qua UFW). Sửa `.env`, rồi `docker compose up -d` |
| Activity không cập nhật sau Nginx | Thiếu `proxy_buffering off` / `proxy_http_version 1.1` / `Connection ""` |
| Upload skill/file lỗi 413 | Tăng `client_max_body_size` trong Nginx |
| Bị đăng xuất sau mỗi lần cập nhật | Thư mục `./keys` không được mount: dùng `docker-compose.yml` mới nhất của repo |
| Agent không tới được target | Kiểm tra egress firewall, DNS nội bộ, và việc target có whitelist IP VPS chưa |
| Lỗi khác | `docker compose logs --tail 200 artex`, và HUONG-DAN §15 |
