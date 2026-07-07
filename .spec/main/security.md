# Security — Bảo mật hợp nhất (.spec/main)

> Trạng thái bảo mật cấp hệ thống, hợp nhất từ các integration. Chi tiết theo tính năng ở `feature/<slug>/security.md`.

## 1. Nguyên tắc xuyên suốt
- Zero Trust · Least Privilege · Defense in Depth · Secure by Design.
- **Secrets chỉ ở ENV** (Vercel), không hardcode/commit/log/trả API. `.gitignore` chặn `.env*`. Claude nhận `ANTHROPIC_API_KEY` **hoặc** `ANTHROPIC_AUTH_TOKEN` (OAuth `sk-ant-oat`, ngắn hạn — xoay/cập nhật thủ công; có cả hai ⇒ ưu tiên token); bơm vào tiến trình `claude` CLI con qua ENV (không qua arg). CLI chạy `--permission-mode plan` (chỉ-đọc) chống prompt-injection; config dir cô lập. (i-20260707223448)
- Guard server-side mọi route nhạy cảm (không tin client).

## 2. Trust boundaries & guard
| Bề mặt | Cơ chế bảo vệ | Nguồn |
|--------|---------------|-------|
| Admin UI + `/api/admin/*` | Session NextAuth (vai trò `admin`), CSRF (SameSite + Origin/token) | i-20260706231719 |
| `/api/cron/*`, `/api/worker/*` | `CRON_SECRET` (constant-time) + chữ ký QStash | i-20260706231719 |
| `/api/public/unsubscribe/:token` | Capability-token ngẫu nhiên ≥128-bit, chỉ set active=false | i-20260706231719 |
| Outbound (Claude/Firecrawl/Apify/Gmail) | Retry/timeout/circuit-breaker; Firecrawl chống SSRF | i-20260706231719; i-20260707223448 (Claude thay Perplexity) |

## 3. Rủi ro CRITICAL/HIGH nổi bật
- `[CRITICAL]` Hở auth admin/worker → EoP + spam email + đốt quota trả phí.
- `[CRITICAL]` Lộ secret qua log/error/response.
- `[HIGH]` NoSQL injection (validate zod), CSRF mutation admin, DoS gọi cron/worker (rate-limit), SSRF Firecrawl.
- `[MEDIUM]` XSS nội dung nguồn ở email/preview (sanitize/escape + CSP), rò rỉ PII email (DTO/projection).

## 4. Kiểm soát bắt buộc (checklist go-live)
- [ ] Guard tập trung + kiểm mọi HTTP method.
- [ ] `.env*` bị .gitignore; `.env.example` không giá trị thật; validate env fail-fast (không in giá trị).
- [ ] Input validate/ép kiểu bằng zod (chống NoSQL injection).
- [ ] Không render HTML thô nguồn tin (escape/sanitize) + CSP.
- [ ] Cookie HttpOnly/Secure/SameSite; bcrypt; rate-limit login/unsubscribe/run-now.
- [ ] Error handler generic prod; DTO loại field nhạy cảm (hash/token).
- [ ] Alert email admin cho sự kiện an ninh/vận hành; audit mutation admin.
- [ ] Runbook xoay secret + cờ tắt cron khẩn cấp + backup Atlas.

## 5. Không áp dụng (GĐ1)
Multi-tenant, SSO, upload file — ghi nhận cho tương lai (thêm ownerId khi multi-user).
