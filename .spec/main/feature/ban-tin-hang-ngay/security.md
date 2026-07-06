---
integration: i-20260706231719-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: security
status: approved
open_questions: 0
updated: 2026-07-06
---

# Asset Inventory

| Tài sản | Loại | Độ nhạy cảm | Nơi lưu | Ai truy cập |
|---------|------|-------------|---------|-------------|
| API keys (Perplexity/Firecrawl/Apify) | Secret | CAO (trả phí, lạm dụng ⇒ mất tiền) | ENV (Vercel) | Runtime server |
| Gmail App Password + user | Secret | CAO (chiếm dụng hòm thư gửi) | ENV | Runtime server (MailAdapter) |
| MongoDB URI | Secret | CAO (toàn bộ DB) | ENV | Runtime server |
| `CRON_SECRET` / chữ ký QStash | Secret | CAO (kích hoạt job) | ENV | Cron/worker |
| `NEXTAUTH_SECRET` | Secret | CAO (giả mạo session) | ENV | Auth |
| Admin credential (`ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`) | Credential | CAO | ENV → seed `admin_users` | Admin |
| Subscriber emails | PII | TRUNG BÌNH (địa chỉ email người khác) | MongoDB `subscribers` | Admin, hệ thống gửi |
| Categories (keywords/scope) | Cấu hình nghiệp vụ | THẤP | MongoDB `categories` | Admin |
| NewsItems (title/url/summary) | Nội dung công khai (dẫn xuất) | THẤP | MongoDB `news_items` | Admin, email |
| Run/Delivery logs | Vận hành/audit | THẤP–TB (có thể chứa email) | MongoDB | Admin |
| Session cookie admin | Token | CAO | Trình duyệt admin | Admin |
| `unsubscribeToken` | Capability token | TRUNG BÌNH | `subscribers` + link email | Người nhận |

# Threat Model (STRIDE)

| STRIDE | Threat cụ thể | Phần tử/Trust boundary | Tác động | Mitigation | Mức |
|--------|---------------|------------------------|----------|------------|-----|
| **S** Spoofing | Giả Vercel Cron gọi `/api/cron/*`; giả QStash gọi `/api/worker/*` | Internet → API máy-máy | Đốt quota trả phí, gửi email trái phép | Bearer `CRON_SECRET` (so sánh constant-time) + verify chữ ký QStash; từ chối nếu thiếu | `[HIGH]` |
| **S** Spoofing | Đăng nhập admin bằng credential đoán/nhồi | Internet → Admin UI | Chiếm toàn quyền | Rate-limit login, khóa tạm, mật khẩu mạnh, bcrypt | `[HIGH]` |
| **T** Tampering | Thêm/sửa email nạn nhân qua API admin không auth | Admin API | Biến hệ thống thành spam-cannon | Auth admin bắt buộc + validate + audit | `[CRITICAL]` |
| **T** Tampering | NoSQL injection sửa filter Mongo | API → DB | Vượt lọc, đọc/sửa dữ liệu ngoài ý | Validate/cast kiểu (zod), không truyền object thô vào query | `[HIGH]` |
| **R** Repudiation | Không truy được ai đổi danh mục/email | Admin | Mất dấu vết | Change history + run/delivery logs | `[MEDIUM]` |
| **I** Info Disclosure | Lộ secrets qua log/response/error stack | Server | Mất tiền, chiếm hòm thư/DB | Không log secret; error message generic; không trả env | `[CRITICAL]` |
| **I** Info Disclosure | Enumerate email/subscriber qua unsubscribe hoặc API | Public/Admin API | Rò rỉ PII | Token ngẫu nhiên ≥128-bit; trang unsubscribe không tiết lộ email khác; API admin chỉ trả dữ liệu tối thiểu | `[MEDIUM]` |
| **D** DoS | Spam gọi cron/worker/unsubscribe | Public endpoints | Cạn quota/chi phí, nghẽn | Secret + rate limit + circuit breaker mềm theo adapter | `[HIGH]` |
| **E** EoP | Người thường truy cập route admin/worker | Trust boundary | Toàn quyền/kích hoạt job | Guard tập trung (middleware) mọi route nhạy cảm | `[CRITICAL]` |
| **T/I** | HTML độc từ nguồn tin chèn vào email/preview (stored XSS) | Nguồn ngoài → email/admin | Chiếm phiên admin khi preview; email độc | Sanitize/escape khi render; CSP cho trang admin | `[MEDIUM]` |
| **I/D** SSRF | Firecrawl bị ép crawl URL nội bộ/metadata | Adapter → mạng nội bộ | Lộ hạ tầng/credential cloud | Chỉ URL công khai (http/https), chặn IP nội bộ/link-local | `[MEDIUM]` |

# Attack Surface

- **Web/Admin UI** `[CRITICAL nếu hở auth]`: đăng nhập, CRUD danh mục, CRUD email, preview bản tin, run-now. Bề mặt nhạy cảm nhất (ghi PII, kích hoạt tốn tiền).
- **Admin API** `/api/admin/*` `[CRITICAL]`: mọi mutation phải sau session.
- **Cron/Worker API** `/api/cron/*`, `/api/worker/*` `[HIGH]`: máy-máy, bảo vệ bằng secret/chữ ký.
- **Public API** `/api/public/unsubscribe/:token` `[MEDIUM]`: vô danh, capability-token; giới hạn hành động (chỉ tắt).
- **Tích hợp bên thứ ba** (Perplexity/Firecrawl/Apify/Gmail) `[HIGH]`: kênh outbound, rủi ro quota/nội dung độc/SSRF.
- **Không có**: mobile, SSO, upload file, import (ghi "Không phát hiện" ở mục tương ứng).

# Authentication Review

- `[HIGH]` **Login admin** (*OWASP A07*): dùng NextAuth Credentials, mật khẩu **bcrypt** (cost ≥ 10), so khớp không lộ timing. Bắt buộc **rate-limit + lockout** chống brute-force/credential stuffing (chưa có ở thiết kế → thêm).
- `[MEDIUM]` **Password policy**: tối thiểu độ dài/độ phức tạp cho admin; App Password Gmail phải là app-password (không dùng mật khẩu chính).
- `[MEDIUM]` **MFA**: chưa có; với 1 admin, khuyến nghị bật (ít nhất TOTP) vì tài khoản này = toàn quyền — ghi nhận (không chặn GĐ1).
- `[LOW]` **Reset password**: GĐ1 seed từ env, chưa có luồng reset self-service → đổi qua env + reseed (tài liệu hóa).

# SSO Review

**Không áp dụng** (giai đoạn 1 không dùng SSO/OIDC/SAML). Ghi nhận nếu mở rộng nhiều người dùng.

# Session Review

- `[HIGH]` **Cookie session**: phải `HttpOnly` + `Secure` + `SameSite=Lax/Strict` để chống hijack/CSRF; `NEXTAUTH_SECRET` mạnh, xoay khi nghi lộ.
- `[MEDIUM]` **Timeout & revocation**: đặt thời hạn session hợp lý; có cách đăng xuất/thu hồi. Fixation: NextAuth phát cookie mới sau đăng nhập (đảm bảo cấu hình đúng).
- `[LOW]` **Concurrent session**: 1 admin — rủi ro thấp.

# Authorization Review

- `[CRITICAL]` (*OWASP A01/API5*) **Mọi route admin/mutation phải kiểm tra vai trò `admin`** ở server (không chỉ ẩn nút trên UI). Áp **guard tập trung** (middleware + kiểm tra trong từng route handler — Zero Trust, không tin client).
- `[HIGH]` **Cron/worker**: authorization theo secret/chữ ký, tách hoàn toàn khỏi session người dùng.
- `[MEDIUM]` **Unsubscribe**: authorization theo capability-token, phạm vi đúng 1 subscriber.

# Permission Scope Review

| Permission | Scope dự kiến | Scope thực tế | Rủi ro nới quyền | Mức |
|------------|---------------|---------------|------------------|-----|
| CRUD Category | Admin toàn hệ thống | Admin | Nếu quên guard 1 method (PATCH/DELETE) → hở | `[CRITICAL]` |
| CRUD Subscriber | Admin | Admin | Thêm email nạn nhân nếu hở | `[CRITICAL]` |
| Trigger collect/send/run-now | Máy (secret) + admin (run-now) | secret/session | run-now nếu quên auth → đốt quota | `[HIGH]` |
| Unsubscribe (set active=false) | 1 subscriber theo token | token | Token đoán được → tắt nhầm người khác | `[MEDIUM]` |
| View runs/logs | Admin | Admin | Logs chứa email → rò rỉ nếu hở | `[MEDIUM]` |

# Multi Tenant Security Review

**Không áp dụng** ⚠️ — giai đoạn 1 đơn admin, không đa tổ chức, không có ranh giới tenant. **Cảnh báo tương lai**: nếu mở SaaS nhiều người dùng, PHẢI thêm `ownerId` và kiểm tra ownership trên mọi query (`categories`/`subscribers`/`news_items`) để tránh cross-tenant BOLA — hiện chưa có nên **tuyệt đối không expose API ra ngoài dạng multi-user** khi chưa bổ sung.

# API Security Review

| OWASP API | Endpoint | Vấn đề | Tác động | Mức |
|-----------|----------|--------|----------|-----|
| API1 BOLA | `/api/admin/categories/:id`, `.../subscribers/:sid` | Nếu không kiểm tồn tại/ownership (khi thêm multi-user) → truy cập id bất kỳ | Sửa/xóa dữ liệu | `[HIGH]` (GĐ1: chỉ cần auth; ghi nhận cho multi-user) |
| API2 Broken Auth | `/api/cron/*`, `/api/worker/*` | Thiếu/verify sai secret | Kích hoạt job trái phép | `[HIGH]` |
| API3 Excessive Data | `/api/admin/*` responses | Trả dư field (token, hash) | Rò rỉ | `[MEDIUM]` |
| API4 Resource Consumption | collect/worker | Không giới hạn số category/độ dài keyword | Đốt quota/DoS | `[HIGH]` |
| API5 BFLA | mọi mutation | Thiếu kiểm vai trò theo function | EoP | `[CRITICAL]` |
| API8 Misconfig | CORS/headers | CORS mở, thiếu security headers | Nhiều | `[MEDIUM]` |
| API6 Unrestricted access to sensitive flows | unsubscribe/run-now | Thiếu rate limit | Lạm dụng | `[MEDIUM]` |

# Injection Risks

- `[HIGH]` **NoSQL Injection (MongoDB)** (*OWASP A03*): nếu truyền trực tiếp giá trị request vào filter (`{ email: req.body.email }` với body là object `{$ne:null}`), attacker vượt lọc/truy vấn ngoài ý. **Mitigation**: validate & ép kiểu bằng **zod** trước khi query; không nhận operator từ client; dùng driver có typing.
- `[MEDIUM]` **Command/Path/Template**: không thực thi shell/đọc file theo input người dùng ⇒ rủi ro thấp; giữ nguyên tắc không nội suy input vào lệnh hệ thống.
- `[LOW]` **Log injection**: escape khi ghi log giá trị người dùng.

# XSS Risks

- `[MEDIUM]` **Stored XSS qua nội dung tin**: title/summary/HTML từ nguồn ngoài hiển thị ở **trang preview admin** và **email**. React tự escape trong UI, nhưng nếu dùng `dangerouslySetInnerHTML` cho nội dung nguồn → nguy hiểm. **Mitigation**: KHÔNG render HTML thô của nguồn; chỉ dùng text đã escape; nếu cần HTML → sanitize (allowlist thẻ). Thêm **CSP** cho trang admin.
- `[LOW]` **Reflected/DOM XSS**: query param trang admin cần escape.

# CSRF Risks

- `[HIGH]` **CSRF trên mutation admin** (POST/PATCH/DELETE danh mục/email, run-now): nếu chỉ dựa cookie session mà không có chống CSRF → trang độc có thể ép admin thực hiện. **Mitigation**: `SameSite=Lax/Strict` cookie + **CSRF token** (NextAuth có sẵn cơ chế cho một số luồng; với route handler tự viết cần token/double-submit hoặc kiểm `Origin`/`Fetch metadata`).
- `[LOW]` **Cron/worker** dùng Bearer secret (không dùng cookie) ⇒ không bị CSRF.

# File Upload Risks

**Không phát hiện** — hệ thống không có chức năng upload/import file ở giai đoạn này.

# Data Protection Review

- `[MEDIUM]` (*OWASP A02*) **Subscriber email là PII**: tối thiểu hóa dữ liệu (chỉ lưu email + trạng thái + token); không xuất/log email không cần thiết; cân nhắc **masking** email trong log/UI runs.
- `[LOW]` **NewsItems** là nội dung công khai — độ nhạy thấp.
- `[MEDIUM]` **Data minimization**: không lưu thêm PII người nhận ngoài email.

# Encryption Review

- `[HIGH]` **In transit**: bắt buộc HTTPS (Vercel mặc định TLS); kết nối MongoDB Atlas qua TLS; SMTP Gmail qua TLS (STARTTLS/SSL).
- `[MEDIUM]` **At rest**: dựa MongoDB Atlas encryption-at-rest (mặc định). Không tự lưu secret trong DB.
- `[MEDIUM]` **Key management**: secrets ở Vercel Env (mã hóa), không commit `.env`; có `.env.example` không chứa giá trị thật; xoay key khi nghi lộ.

# Secret Management Review

- `[CRITICAL]` **Tất cả secret chỉ ở ENV** (Vercel), **không hardcode**, **không commit**, **không log**, **không trả qua API**. `.gitignore` phải chặn `.env*` (trừ `.env.example`).
- `[HIGH]` **Không đưa secret ra client**: chỉ dùng ở server (route handler/server action); biến `NEXT_PUBLIC_*` tuyệt đối không chứa secret.
- `[MEDIUM]` **Validate env lúc khởi động** (fail fast, báo thiếu key nào) nhưng **không in giá trị**; thiếu key adapter ⇒ loại adapter (không lỗi toàn cục).
- `[MEDIUM]` **Xoay vòng**: quy trình xoay API key/App Password khi rời dự án/nghi lộ.

# Audit Review

- `[MEDIUM]` (*OWASP A09*) **Change history** cho CRUD danh mục & email (ai/khi nào/giá trị cũ-mới) — hiện chỉ có run/delivery logs; bổ sung audit cho mutation admin.
- `[MEDIUM]` **Run/Delivery logs bất biến**: chỉ append, không sửa; đủ để truy vết mỗi run.
- `[LOW]` **Login history**: ghi đăng nhập thành công/thất bại của admin.

# Security Event Catalog

| Sự kiện | Có ghi log? | Có cảnh báo? | Mức |
|---------|-------------|--------------|-----|
| Login Failed (admin) | Cần | Cảnh báo nếu nhiều lần | `[HIGH]` |
| Login Success (admin) | Cần | Không | `[LOW]` |
| Password/Credential Changed | Cần | Có | `[MEDIUM]` |
| Category/Subscriber Created/Updated/Deleted | Cần (audit) | Không | `[MEDIUM]` |
| Cron/Worker gọi thiếu/sai secret | Cần | Có (nghi tấn công) | `[HIGH]` |
| Adapter fail / no-adapter / collect chưa xong lúc gửi | Cần | Có (email admin) | `[HIGH]` |
| Gửi email thất bại | Cần | Có nếu diện rộng | `[MEDIUM]` |

# Monitoring Gaps

- `[HIGH]` Chưa có **cảnh báo** cho: gọi cron/worker sai secret (dấu hiệu dò), spike lỗi adapter (nghi lạm dụng), gửi email fail hàng loạt. Bổ sung alert email admin + structured log.
- `[MEDIUM]` Chưa có **giám sát quota/chi phí** công cụ trả phí theo ngày (phát hiện lạm dụng sớm).
- `[LOW]` Chưa tích hợp SIEM/anomaly detection (không cần ở quy mô hiện tại).

# Data Leakage Risks ⚠️

- `[CRITICAL]` (*OWASP API3*) **Lộ secret trong error/stack/log** → mất tiền/chiếm hòm thư. Mitigation: error handler generic ở production, không trả stack, không log secret.
- `[HIGH]` **API admin trả dư field** (passwordHash, unsubscribeToken, nội bộ) → chỉ trả field cần (DTO/projection), loại field nhạy cảm.
- `[MEDIUM]` **Rò rỉ danh sách email** qua logs/preview/response nếu hở auth hoặc dư dữ liệu.
- `[LOW]` **Search/preview** hiển thị nội dung công khai — rủi ro thấp.

# Privilege Escalation Risks ⚠️

- `[CRITICAL]` **Vertical EoP**: người vô danh gọi thẳng `/api/admin/*` hoặc `/api/worker/*` nếu thiếu guard → thao tác như admin/máy. Mitigation: guard tập trung + kiểm mọi handler (Zero Trust).
- `[HIGH]` **Function-level bypass (BFLA)**: quên bảo vệ 1 HTTP method (vd DELETE) trong khi bảo vệ GET/POST. Mitigation: guard theo route + test phủ mọi method.
- `[MEDIUM]` **Horizontal (tương lai multi-user)**: thiếu ownership check → truy cập dữ liệu người khác; hiện đơn admin nên chưa hiện hữu, ghi nhận.

# Security Misconfiguration Risks

- `[MEDIUM]` (*OWASP A05/API8*) **CORS**: mặc định không mở CORS cho API admin/cron (same-origin). Nếu cấu hình sai `*` → nguy hiểm.
- `[MEDIUM]` **Security headers**: thêm `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options/frame-ancestors`, `Referrer-Policy`, HSTS.
- `[MEDIUM]` **Cookie flags** đúng (HttpOnly/Secure/SameSite).
- `[LOW]` **Verbose error** tắt ở production; không lộ phiên bản/stack.

# Incident Response Risks

- `[HIGH]` **Thu hồi khi lộ secret**: cần quy trình xoay API key/App Password/`CRON_SECRET`/`NEXTAUTH_SECRET` nhanh (tài liệu hóa runbook).
- `[MEDIUM]` **Vô hiệu hóa khẩn cấp**: cờ tắt toàn bộ cron (env) khi phát hiện lạm dụng; khóa tài khoản admin.
- `[MEDIUM]` **Khôi phục**: MongoDB Atlas backup bật; có thể chạy lại collect/send idempotent cho ngày lỗi.

# Zero Trust Assessment

| Nguyên tắc | Hiện trạng | Khoảng trống | Mức |
|------------|------------|--------------|-----|
| Never Trust | Guard server-side mọi route | Rủi ro quên guard 1 method | `[HIGH]` |
| Always Verify | Session admin + secret máy-máy | Cần verify chữ ký QStash đúng cách | `[HIGH]` |
| Least Privilege | Unsubscribe chỉ tắt; adapter chỉ đọc | App Password Gmail quyền gửi rộng | `[MEDIUM]` |
| Continuous Validation | Validate env + input (zod) | Chưa có rate limit/anomaly | `[MEDIUM]` |

# Open Security Questions

> Không còn câu hỏi bảo mật **chặn**. Các quyết định-mặc-định (không chặn code):
1. ✅ MFA cho admin: khuyến nghị nhưng **không bắt buộc GĐ1** (1 người dùng). Bật khi mở rộng.
2. ✅ Rate-limit/lockout login + rate-limit unsubscribe/run-now: **bắt buộc hiện thực** (dùng middleware/edge hoặc Upstash Ratelimit nếu có env).
3. 🟡 Cơ chế CSRF cụ thể (CSRF token vs kiểm `Origin`/Fetch-metadata) → chốt ở /tn-code; mặc định SameSite + kiểm Origin cho route tự viết.

# Security Recommendations

- `[Ưu tiên 1 — Broken Access Control]` **Guard tập trung** (middleware) chặn mọi `/api/admin/*` (session `admin`) và `/api/cron|worker/*` (secret/chữ ký); kiểm lại trong từng handler; test phủ mọi HTTP method. *(Quick-win)*
- `[Ưu tiên 2 — Secret/Data Leakage]` Secrets chỉ ở ENV, `.gitignore` chặn `.env*`, error handler generic, DTO/projection loại field nhạy cảm (hash/token), không log secret/PII. *(Quick-win)*
- `[Ưu tiên 3 — Privilege Escalation/DoS]` `CRON_SECRET` so sánh constant-time + verify chữ ký QStash; **rate-limit** login/unsubscribe/run-now; giới hạn số category & độ dài keyword. *(Quick-win)*
- `[Ưu tiên 4 — Injection/XSS]` Validate/ép kiểu mọi input bằng **zod** (chống NoSQL injection); KHÔNG render HTML thô của nguồn (escape/sanitize) ở email & preview; thêm CSP. *(Quick-win)*
- `[Ưu tiên 5 — SSRF]` Firecrawl chỉ nhận URL công khai http/https, chặn IP nội bộ/link-local/metadata endpoint. *(Quick-win)*
- `[Ưu tiên 6 — Auth hardening]` Cookie HttpOnly/Secure/SameSite, `NEXTAUTH_SECRET` mạnh, bcrypt cost ≥10, timeout/lockout; cân nhắc MFA. *(Trung hạn)*
- `[Ưu tiên 7 — Audit/Monitoring]` Change history cho mutation admin + alert email admin cho sự kiện an ninh/vận hành; giám sát quota/chi phí. *(Trung hạn)*
- `[Ưu tiên 8 — IR]` Runbook xoay secret + cờ tắt cron khẩn cấp + bật backup Atlas. *(Trung hạn)*
