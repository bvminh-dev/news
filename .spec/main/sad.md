# SAD — System Architecture Document (hợp nhất)

> Kiến trúc cấp hệ thống, hợp nhất từ các integration. Chi tiết theo tính năng ở `feature/<slug>/tech.md`.

## 1. Bối cảnh & Kiểu kiến trúc
- **Kiểu:** Modular Monolith + Clean/Hexagonal (Ports & Adapters) trên **Next.js (App Router) + Vercel Serverless**, DB **MongoDB (Atlas)**. (i-20260706231719-ban-tin-hang-ngay)
- **Nguyên tắc xuyên suốt:** không hardcode — mọi cấu hình/secret ở **ENV**; adapter cắm qua interface, chọn theo env (thiếu key ⇒ loại adapter).

## 2. Bounded Contexts
| Context | Loại | Trách nhiệm | Nguồn |
|---------|------|-------------|-------|
| News Aggregation & Ranking | Core | Thu thập đa nguồn, dedup, xếp hạng nổi bật (AI+engagement), chọn Top N | i-20260706231719 |
| Category & Subscription | Supporting | CRUD danh mục + người nhận | i-20260706231719 |
| Digest Delivery | Supporting | Render + gửi email + theo dõi gửi | i-20260706231719 |
| Admin Identity/Auth | Generic | Đăng nhập admin, secret cron/worker | i-20260706231719 |
| Config & Scheduling | Generic | ENV + Vercel Cron | i-20260706231719 |

## 3. Container & Luồng vận hành
- **Web/Admin UI** (RSC + route handlers, sau Auth) · **API** (`admin`/`cron`/`worker`/`public`) · **Domain core** (collect/rank/dedup/digest) · **Adapters** (NewsSource/Mail/Queue/Repository/Config) · **MongoDB**.
- **06:00 ICT** `/api/cron/collect` → 202 → fan-out `/api/worker/collect` (1/category) → ghi `news_items` + `digest_runs`.
- **06:30 ICT** `/api/cron/send` → fan-out `/api/worker/send` (category `collected`) → gửi → `delivery_logs`.
- Lịch cron trong `vercel.json` theo **UTC** (23:00/23:30 = 06:00/06:30 ICT).
- **Chạy ngay (admin)** `/api/admin/run-now`: force re-collect (đẩy tin cũ +N rank, tin mới rank 1..N, giữ cả hai) → reset delivery_logs hôm nay → gửi email top-N cho subscriber active (đồng bộ). Cron giữ idempotent. (i-20260708000200)

## 4. Mô hình dữ liệu (collections)
`categories`, `subscribers`, `news_items`, `digest_runs`, `delivery_logs`, `admin_users`.
- Idempotency: unique `(date,categoryId,step)` cho run; `(date,categoryId,email)` cho gửi.
- Dedup: index `(categoryId, normalizedUrl)`, `(categoryId, fingerprint, date)`.
- TTL theo `NEWS_RETENTION_DAYS`, ràng buộc `retention ≥ dedupWindow`.

## 5. Tích hợp ngoài
Claude API (web search) · Firecrawl · Apify (thu thập) · Gmail SMTP (gửi) · QStash/waitUntil (fan-out) · Vercel Cron. (i-20260707223448: Claude thay Perplexity)
Mọi adapter: retry + timeout + fallback + circuit-breaker mềm; thiếu env key ⇒ không dùng.

## 6. Bảo mật (tóm tắt)
- Admin: session (NextAuth Credentials, seed env). Cron/worker: `CRON_SECRET` + chữ ký QStash.
- Claude (máy-máy): adapter **spawn `claude` CLI headless** (không SDK); credential qua ENV (`ANTHROPIC_API_KEY`+`--bare` hoặc `CLAUDE_CODE_OAUTH_TOKEN`, ưu tiên token); config dir cô lập + `--permission-mode plan`. `[HIGH]` cần binary + spawn ⇒ **không chạy Vercel serverless** (mâu thuẫn ADR fan-out serverless) → deploy tự host. (i-20260707223448)
- Secrets chỉ ở ENV, không log/không trả API. Sanitize HTML email. Firecrawl chỉ URL công khai.

## 7. ADR chỉ mục
ADR-20260706231719-01..09 — xem `feature/ban-tin-hang-ngay/tech.md`.

## 8. Rủi ro kiến trúc nổi bật
- `[CRITICAL]` Hở auth cron/worker/admin → đốt quota + spam.
- `[HIGH]` Timeout serverless + quota API là điểm vỡ khi scale.
- `[HIGH]` Vercel Cron chỉ UTC — lệch khái niệm "6h sáng" theo TZ env.
