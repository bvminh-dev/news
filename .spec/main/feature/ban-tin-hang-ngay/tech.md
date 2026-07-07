---
integration: i-20260706231719-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: tech
status: approved
open_questions: 0
updated: 2026-07-06
---

# Tóm Tắt Kiến Trúc

**Kiểu kiến trúc:** *Modular Monolith* trên **Next.js (App Router) + Vercel Serverless Functions**, DB **MongoDB (Atlas)**, theo **Clean/Hexagonal** (domain lõi tách khỏi adapter hạ tầng) + **Ports & Adapters** cho các công cụ thu thập.

**C4 — Context:**
- **Actor:** Admin (1 người, giai đoạn 1) — quản lý danh mục & người nhận, xem trước, chạy thủ công.
- **Hệ ngoài:** Claude API (web search), Firecrawl, Apify (thu thập); Gmail SMTP (gửi); (tùy chọn) QStash/Inngest (hàng đợi fan-out); Vercel Cron (bộ lịch). (i-20260707223448: Claude thay Perplexity)

**C4 — Container:**
1. **Web/Admin UI** (Next.js RSC + route handlers) — CRUD + preview, sau `Auth`.
2. **API layer** (route handlers): `admin`, `cron`, `worker`, `public/unsubscribe`.
3. **Domain core** (thuần, không phụ thuộc framework): `collection`, `ranking`, `dedup`, `digest`.
4. **Adapters**: `NewsSourceAdapter` (Claude/Firecrawl/Apify), `MailAdapter` (SMTP), `QueueAdapter` (QStash/waitUntil), `ConfigProvider` (env), `Repository` (Mongo). (i-20260707223448)
5. **MongoDB**: `categories`, `subscribers`, `news_items`, `digest_runs`, `delivery_logs`, `admin_users`.

**Luồng vận hành (2 bước tách rời, idempotent):**
- **06:00 ICT (Cron A → `/api/cron/collect`)**: trả 202 ngay; fan-out mỗi danh mục thành 1 job worker (`/api/worker/collect`) → mỗi worker thu thập trong ngân sách timeout riêng → ghi `news_items` + cập nhật `digest_runs.status`.
- **06:30 ICT (Cron B → `/api/cron/send`)**: đọc `digest_runs` đã `collected` → fan-out `/api/worker/send` mỗi danh mục → render + gửi tới `subscribers` → ghi `delivery_logs`.
- **Chạy ngay (admin, đồng bộ) `/api/admin/run-now`** `[i-20260708000200]`: `collectCategory({force:true})` (bỏ qua idempotency; đẩy rank tin cũ +N; upsert tin mới rank 1..N — giữ cả hai) → nếu `collected`/`partial`: `resetDeliveries` + `sendCategory` (email top-N cho subscriber). `sendCategory` giới hạn `.limit(topN)`. Không gửi khi collect `failed`.

**Phát hiện trọng yếu:**
- `[HIGH]` Ràng buộc **Vercel serverless không chạy nền sau khi HTTP trả về** ⇒ bắt buộc dùng **hàng đợi fan-out** (QStash) hoặc `waitUntil` giới hạn; đã chọn fan-out (ADR-002).
- `[HIGH]` Vercel Cron **chạy theo UTC cố định** trong khi TZ hiển thị cấu hình env ⇒ lệch khái niệm "6h sáng" (ADR-006).
- `[CRITICAL]` Bảo vệ endpoint cron/worker (cron secret + chữ ký hàng đợi) và toàn bộ admin bằng auth — nếu hở → đốt quota trả phí + biến hệ thống thành công cụ spam.

# Domain Model

- **Core Domain — News Aggregation & Ranking:** thu thập đa nguồn, chuẩn hóa, **chống trùng**, **xếp hạng nổi bật (AI relevance + engagement)** → chọn Top N. Đây là giá trị khác biệt.
- **Supporting — Category & Subscription Management:** CRUD danh mục + danh sách người nhận theo danh mục.
- **Supporting — Digest Delivery:** render bản tin + gửi email + theo dõi trạng thái gửi.
- **Generic — Admin Identity/Auth:** đăng nhập admin.
- **Generic — Config & Scheduling:** nạp cấu hình env (không hardcode), lịch cron.
- **Generic — Notification transport:** SMTP (Gmail).

**`[MEDIUM]` Domain Risks:** Ranking/dedup là nơi phức tạp nhất, dễ phình logic; phải cô lập trong domain thuần, test được (không gọi mạng). Nếu để logic ranking nằm rải trong route handler ⇒ nợ kỹ thuật nhanh.

# Ubiquitous Language

| Khái niệm | Tên hiện tại | Vấn đề (đồng nghĩa/đa nghĩa) | Khuyến nghị |
|-----------|--------------|------------------------------|-------------|
| Danh mục chủ đề | Category | "danh mục" ~ category/topic | Dùng **Category** (chủ đề tin: AI, giá vàng…) |
| Tin nổi bật | Highlight / Top item | "nổi bật" mơ hồ | **NewsItem** + `finalScore`/`rank`; "nổi bật" = top-N theo finalScore |
| Người nhận | Recipient / Subscriber | recipient vs subscriber | Dùng **Subscriber** (email đăng ký theo Category) |
| Lượt chạy ngày | Run / Job | run vs job vs batch | **DigestRun** (theo `date`+`category`+`step`) |
| Điểm tương tác | Engagement | thang khác nhau mỗi nền tảng | **engagementScore** (đã chuẩn hóa) vs `rawEngagement` (thô) |
| Công cụ thu thập | Tool / Source | tool vs platform | **NewsSourceAdapter** (Perplexity/Firecrawl/Apify) ≠ **platform** (Reddit/X/FB/TikTok/GitHub) |
| Cửa sổ 24h | Window | tính theo publishedAt hay giờ chạy | **collectionWindow** = [runTime-24h, runTime] theo `publishedAt` nguồn (UTC) |

# Bounded Context

```
[Category & Subscription CTX] --(categoryId, config snapshot)--> [News Aggregation CTX]
[News Aggregation CTX] --(NewsItems đã rank/dedup)--> [Digest Delivery CTX]
[Admin Identity CTX] --(guard)--> tất cả API admin/manual
[Config CTX] --(env values)--> mọi context (Shared Kernel chỉ-đọc)
```
- Quan hệ: **Customer–Supplier** (Aggregation là supplier của Delivery). **ACL** đặt tại mỗi `NewsSourceAdapter` để cách ly định dạng dữ liệu ngoài khỏi domain (mapping RawNewsItem → NewsItem).

**`[MEDIUM]` Context Coupling Risks:** Delivery phụ thuộc dữ liệu Aggregation cùng `date` — nếu Aggregation partial/fail, Delivery phải phát hiện qua `digest_runs.status` (không đọc thẳng `news_items` mà không kiểm run-state) ⇒ tránh gửi email rỗng.

# Aggregate Design

- **Category (Aggregate Root)** — `{ _id, name, slug, description, keywords[], scope[VN|WORLD], topN?, lang?, enabled, createdAt, updatedAt }`. Bất biến nghiệp vụ: `name` unique, ≥1 keyword.
- **Subscriber (AR riêng)** — `{ _id, categoryId(ref), email, active, unsubscribeToken, createdAt }`. Tách khỏi Category (danh sách có thể lớn/thay đổi thường xuyên → không nhét mảng vào Category để tránh document phình & ghi tranh chấp).
- **NewsItem (AR riêng)** — `{ _id, categoryId, date, title, url, normalizedUrl, platform, sourceAdapters[], publishedAt, summary, rawEngagement{}, engagementScore, relevanceScore, finalScore, rank, fingerprint, createdAt }`.
- **DigestRun (AR — run-state)** — `{ _id, date, categoryId, step[collect|send], status, toolsUsed[], counts{found,selected}, errors[], startedAt, finishedAt }`. Idempotency key = `(date, categoryId, step)`.
- **DeliveryLog** — `{ _id, date, categoryId, email, status, attempts, error, sentAt }`. Idempotency key = `(date, categoryId, email)`.
- **AdminUser (AR)** — `{ _id, email, passwordHash, createdAt }`. Seed từ env.

**`[MEDIUM]`** Không gộp Subscriber/NewsItem vào Category (tránh aggregate quá lớn & transaction xuyên aggregate). Không có transaction đa-document phức tạp ⇒ MongoDB single-document atomicity + unique index là đủ.

# Domain Events

| Command | Event | Policy | Vấn đề (missing/duplicate/circular) |
|---------|-------|--------|-------------------------------------|
| TriggerDailyCollect | CollectRequested(date) | Fan-out mỗi category → CollectCategory | `[HIGH]` phải idempotent theo `date` (Vercel retry cron) |
| CollectCategory | CategoryCollected(date,catId) | Khi tất cả collected → cho phép Send | `[MEDIUM]` cần đếm hoàn tất để 6:30 biết đủ |
| RankAndDedup | NewsItemsRanked | Ghi Top N vào news_items | `[MEDIUM]` dedup phải chạy trước ghi |
| TriggerDailySend | SendRequested(date) | Fan-out category có status=collected | `[HIGH]` không gửi nếu status≠collected |
| SendCategoryDigest | DigestSent / DigestPartiallyFailed | Ghi delivery_logs; alert nếu fail | `[MEDIUM]` retry người nhận lỗi |

Sự kiện dùng nội bộ (in-process / qua message hàng đợi), **không** cần event bus phân tán ở quy mô này.

# Event Storming

`Cron A (06:00)` → **CollectRequested** → Policy fan-out → `CollectCategory` (mỗi cat) → gọi adapters → **RawNewsCollected** → `RankAndDedup` → **NewsItemsRanked** → Read Model `news_items` + `digest_runs(collected)`.
`Cron B (06:30)` → **SendRequested** → Policy (chỉ cat `collected`) → `SendCategoryDigest` → **DigestSent/Partial** → Read Model `delivery_logs`.

**`[MEDIUM]` Event Gaps:** thiếu event/alert khi **không có adapter khả dụng** (mọi env key trống) và khi **collect chưa xong lúc 06:30** — phải có policy cảnh báo admin (Observability).

# Data Ownership Matrix

| Data Item | Owner | Master System | Consumer System | Quyền sửa | Vấn đề |
|-----------|-------|---------------|-----------------|-----------|--------|
| Category | Category CTX | MongoDB | Aggregation, Delivery | Admin | — |
| Subscriber | Subscription CTX | MongoDB | Delivery | Admin (+ public: chỉ set active=false qua unsubscribe) | `[HIGH]` unsubscribe chỉ được phép tắt, không sửa dữ liệu khác |
| NewsItem | Aggregation CTX | MongoDB (dẫn xuất từ nguồn ngoài) | Delivery | Hệ thống (không sửa tay) | `[MEDIUM]` là dữ liệu dẫn xuất — nguồn thật là API ngoài |
| DigestRun/DeliveryLog | Hệ thống | MongoDB | Admin (đọc) | Hệ thống | — |
| Secrets/Config | Config CTX | **ENV (Vercel)** | Toàn hệ thống | Vận hành | `[CRITICAL]` không ghi vào DB, không log |

# Source Of Truth Matrix

| Data Item | Ứng viên nguồn | Source of Truth | Quy tắc khi conflict |
|-----------|----------------|-----------------|----------------------|
| Nội dung tin (title/url/publishedAt) | Perplexity / Firecrawl / Apify | **Nguồn gốc (URL bài viết)**; DB chỉ là snapshot ngày | Ưu tiên bản có `publishedAt` rõ ràng + URL chuẩn hóa |
| Engagement | Apify (theo platform) | **Apify** (nếu có); nếu không có → engagement=0, chỉ xếp theo relevance | Cùng tin nhiều platform → cộng dồn có trọng số |
| Danh mục & người nhận | MongoDB | **MongoDB** | Admin là người quyết |
| Cấu hình runtime | ENV | **ENV** | Env thắng mọi giá trị mặc định trong code |

# Historical Data Analysis

- **Current:** bản tin ngày hiện tại (`news_items.date = today`).
- **Historical:** giữ các ngày trước để (a) chống trùng theo dedup window, (b) xem lại/preview.
- **Snapshot:** `news_items` là snapshot bất biến của tin tại thời điểm thu thập (title/summary tại ngày đó — không cập nhật lại kể cả nguồn đổi).
- **Audit:** `digest_runs`, `delivery_logs` là lịch sử vận hành.

**`[MEDIUM]` Historical Data Risks:** không sửa lại NewsItem cũ (giữ tính bất biến báo cáo); nếu đổi thuật toán ranking, tin cũ vẫn giữ score cũ (đánh dấu `algoVersion` để truy vết).

# Data Lifecycle Analysis

- **Create:** collect ghi NewsItem/DigestRun; admin tạo Category/Subscriber.
- **Active:** Category `enabled`; Subscriber `active`.
- **Inactive:** Category disabled (không thu thập); Subscriber unsubscribe → `active=false` (không xóa — giữ vết & tránh re-add nhầm).
- **Archived/Purged:** NewsItem/DigestRun/DeliveryLog quá `NEWS_RETENTION_DAYS` → **TTL index** tự xóa (env cấu hình). Dedup window ≤ retention.

**`[HIGH]` Risk:** nếu `DEDUP_WINDOW_DAYS > NEWS_RETENTION_DAYS` → dedup mất dữ liệu đối chiếu ⇒ ràng buộc validate `retention ≥ dedupWindow` khi khởi động.

# Architecture Pattern Review

- **Đề xuất:** Modular Monolith + Hexagonal (Ports & Adapters). Domain core (ranking/dedup/digest) thuần, không import Next/Mongo/SDK ngoài. Adapter cắm qua interface, chọn theo env.
- **`[MEDIUM]` Over-engineering cần tránh:** KHÔNG microservices, KHÔNG event bus ngoài (Kafka), KHÔNG CQRS đầy đủ ở quy mô 1 user/vài chục category.
- **`[HIGH]` Under-engineering cần tránh:** KHÔNG nhồi thu thập + rank + gửi trong 1 route handler đồng bộ (vỡ timeout, không test được).
- **Pattern Recommendation:** Pipeline (collect → normalize → dedup → rank → select) + Registry cho adapters + Strategy cho ranking weights.

# API Review

- **Naming/versioning:** REST dưới `/api`, prefix nhóm rõ (`/api/admin/*`, `/api/cron/*`, `/api/worker/*`, `/api/public/*`). Versioning chưa cần (nội bộ) — ghi nhận `/api/v1` khi mở API ra ngoài.
- **Endpoints chính:**
  - `POST /api/cron/collect` (cron secret) → 202, fan-out.
  - `POST /api/worker/collect` (chữ ký queue/secret) body `{date, categoryId}` — idempotent.
  - `POST /api/cron/send` (cron secret) → 202, fan-out.
  - `POST /api/worker/send` (chữ ký queue/secret) `{date, categoryId}` — idempotent.
  - `GET/POST/PATCH/DELETE /api/admin/categories[/:id]` (auth).
  - `GET/POST/DELETE /api/admin/categories/:id/subscribers` (auth).
  - `POST /api/admin/run-now` (auth) — chạy thủ công 1 danh mục.
  - `GET /api/public/unsubscribe/:token` (public) — chỉ set active=false.
- **`[MEDIUM]` Idempotency:** worker phải upsert theo idempotency key `(date, categoryId, step)`; nếu đã `sent`/`collected` → no-op trả 200. Pagination cho danh sách subscriber/news khi admin xem.

# Integration Review

| Hệ ngoài | Retry | Timeout | Fallback | Circuit Breaker | Rủi ro |
|----------|-------|---------|----------|-----------------|--------|
| Claude API (web search) | SDK retry 2 | SDK mặc định | bỏ qua nguồn này, dùng adapter khác | ngưỡng lỗi/ngày → tắt tạm | `[HIGH]` quota/chi phí web search (i-20260707223448) |
| Firecrawl | 2–3 backoff | có | bỏ qua | như trên | `[MEDIUM]` SSRF/nội dung độc |
| Apify (actors) | poll async có giới hạn | có (chạy có thể lâu) | engagement=0, xếp theo relevance | như trên | `[HIGH]` chạy lâu → phải trong worker riêng |
| Gmail SMTP | 2 lần/người nhận | có | ghi failed, alert | ~500/ngày | `[MEDIUM]` giới hạn gửi |
| QStash (tùy chọn) | tự retry của QStash | — | fallback `waitUntil` tuần tự | — | `[MEDIUM]` phụ thuộc thêm dịch vụ |

**Nguyên tắc "thiếu env key ⇒ không dùng adapter đó"** hiện thực bằng **Adapter Registry** đọc env lúc khởi tạo.

# Integration Failure Analysis

| Kịch bản lỗi | Hệ thống còn chạy? | Mất dữ liệu? | Xử lý mong đợi |
|--------------|--------------------|--------------|----------------|
| Claude API refusal/5xx | Có | Không | retry→bỏ qua, dùng adapter còn lại; run=partial nếu thiếu (i-20260707223448) | 
| Tất cả adapter trống key | Có | Không | không thu thập, `digest_runs=failed`, **alert admin**, 06:30 không gửi rỗng `[HIGH]` |
| Apify job treo | Có | Không | timeout poll → engagement=0, tiếp tục | 
| Mongo down | Dừng an toàn | Không (chưa ghi) | log/alert, cron sau chạy lại (idempotent) `[HIGH]` |
| SMTP lỗi 1 phần | Có | Không | retry người nhận lỗi, ghi failed, `status=partial` |
| Cron chạy 2 lần (Vercel retry) | Có | Không | idempotency key chặn ghi/gửi trùng `[HIGH]` |

# Multi Tenant Review

**Không áp dụng** (giai đoạn 1: đơn admin, không đa tổ chức). Ghi nhận: nếu mở SaaS nhiều người dùng → cần `ownerId/tenantId` trên Category/Subscriber/NewsItem + isolation (pool model) — hiện **chưa** thêm để tránh over-engineering, nhưng đặt tên khóa để dễ thêm sau.

# Authentication Review

- **NextAuth (Auth.js) Credentials provider** hoặc middleware session; admin seed từ env (`ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` bcrypt) → lưu `admin_users`. Session cookie HttpOnly/Secure. `NEXTAUTH_SECRET` từ env.
- **Cron/worker không dùng session** mà dùng **shared secret**: `CRON_SECRET` (header `Authorization: Bearer` do Vercel Cron gửi) + chữ ký QStash cho worker.
- `[i-20260707223448]` **Claude (máy-máy) — spawn `claude` CLI headless** (`claude -p`, không dùng SDK Messages API). `ClaudeAdapter` nhận diện credential theo tiền tố rồi bơm qua ENV tiến trình con: `sk-ant-api...` → `ANTHROPIC_API_KEY`+`--bare`; `sk-ant-oat...` → `CLAUDE_CODE_OAUTH_TOKEN`. Xoá ENV auth kế thừa + `CLAUDE_CONFIG_DIR` tạm riêng (cô lập host); prompt qua stdin; `--permission-mode plan` (chỉ-đọc). Registry ưu tiên `anthropicAuthToken`. Lý do dùng CLI: token subscription `sk-ant-oat` chạy được qua CLI (bị `429` nếu gọi thẳng Messages API). `[HIGH]` **Ràng buộc: cần binary `claude` + spawn ⇒ KHÔNG chạy Vercel serverless** — mâu thuẫn ADR-002 (fan-out serverless); deploy tự host/long-running.

**`[HIGH]` Authentication Risks:** phải phân biệt rõ 2 kênh (session người dùng vs secret máy-máy); không để worker/cron mở công khai.

# Authorization Review

- **RBAC tối giản:** 1 vai trò `admin` (mọi quyền quản trị). Public chỉ có 1 hành động vô danh: unsubscribe theo token (khả năng suy đoán thấp — token ngẫu nhiên đủ dài).
- Không có delegation/hierarchy ở giai đoạn 1.

**`[MEDIUM]`** Khi thêm nhiều người dùng → cần scope theo owner; đã ghi nhận.

# Permission Scope Matrix

| Permission | Scope | Boundary | Vấn đề |
|------------|-------|----------|--------|
| CRUD Category | Toàn hệ thống | Chỉ admin đăng nhập | `[CRITICAL]` nếu hở auth |
| CRUD Subscriber | Toàn hệ thống | Chỉ admin | `[CRITICAL]` chống thêm email nạn nhân (spam) |
| Trigger collect/send | Máy (cron/queue) | Chỉ có secret | `[HIGH]` đốt quota/spam nếu lộ |
| Unsubscribe | 1 subscriber theo token | Chỉ set active=false | `[MEDIUM]` token phải khó đoán, không lộ email khác |
| View runs/logs | Admin | Chỉ admin | `[LOW]` |

# Security Threat Model

| STRIDE | Threat cụ thể | Tài sản bị đe dọa | Biện pháp | Mức |
|--------|---------------|-------------------|-----------|-----|
| Spoofing | Giả cron gọi worker | Quota trả phí, dữ liệu | CRON_SECRET + chữ ký QStash | `[HIGH]` |
| Tampering | Sửa danh mục/email trái phép | Subscriber | Auth admin + validate | `[CRITICAL]` |
| Repudiation | Không truy được ai sửa | Audit | change history + run/delivery logs | `[MEDIUM]` |
| Info Disclosure | Lộ API keys/App Password/DB URI | Secrets | chỉ ENV, không log, không trả API | `[CRITICAL]` |
| Info Disclosure | Enumerate email qua unsubscribe | PII | token ngẫu nhiên, không tiết lộ email khác | `[MEDIUM]` |
| DoS | Spam gọi cron/worker | Quota, chi phí | secret + rate limit + circuit breaker | `[HIGH]` |
| EoP | Người thường truy cập admin | Toàn quyền | guard mọi route admin | `[CRITICAL]` |
| Injection | HTML độc từ nguồn vào email | Người nhận | sanitize nội dung khi render | `[MEDIUM]` |
| SSRF | Firecrawl crawl URL nội bộ | Hạ tầng | allowlist/deny nội bộ, chỉ URL công khai | `[MEDIUM]` |

# Performance Risks

- `[HIGH]` Thu thập N category × nhiều adapter đồng bộ trong 1 function → **vỡ timeout**. Giải: fan-out 1 worker/category (song song có kiểm soát).
- `[MEDIUM]` Apify actor chạy lâu (phút) → phải poll trong worker riêng, đặt timeout hợp lý.
- `[MEDIUM]` Query dedup theo window cần **index** `(categoryId, normalizedUrl)` và `(categoryId, fingerprint, date)`.
- `[LOW]` Render email nhiều category — nhẹ ở quy mô hiện tại.

# Scalability Risks

- 10 → 100 category: fan-out theo category vẫn ổn nếu mỗi worker độc lập; **cạnh tranh quota công cụ** hỏng trước (rate limit) → cần hàng đợi có throttle.
- 100 → 1.000 category: cần **QStash/Inngest** thực thụ + concurrency limit + backpressure; Gmail SMTP không đủ (→ dịch vụ email chuyên dụng).
- Người nhận lớn: cần batch gửi + double opt-in + unsubscribe bắt buộc.
- `[HIGH]` Điểm vỡ đầu tiên khi scale: **giới hạn timeout serverless + quota API trả phí** (không phải Mongo).

# Observability Gaps

- `[HIGH]` Cần **structured logging** mỗi run (runId, date, categoryId, adapter, counts, duration, errors) — không log secret.
- `[HIGH]` **Alert admin** khi: không có adapter khả dụng, collect fail/partial, collect chưa xong lúc 06:30, gửi fail. Kênh: email admin (env `ADMIN_ALERT_EMAIL`).
- `[MEDIUM]` Trang admin **Runs/Logs** để xem trạng thái ngày (status, số tin, người nhận sent/failed).
- `[MEDIUM]` Metric chi phí/quota công cụ theo ngày (đếm số call/adapter).

# Technical Debt Risks

- `[MEDIUM]` Logic ranking/dedup dễ phình → phải nằm trong domain core có unit test, tách khỏi adapter.
- `[MEDIUM]` Chuẩn hóa engagement đa nền tảng: chọn phương pháp đơn giản (min-max/percentile theo platform) v1, tránh over-fit.
- `[LOW]` Coupling adapter↔SDK ngoài: cô lập sau interface `NewsSourceAdapter` (ACL).

# ADR Recommendations

| ID | Decision | Reason | Alternative | Trade-Off | Consequence |
|----|----------|--------|-------------|-----------|-------------|
| ADR-20260706231719-01 | Modular Monolith + Hexagonal trên Next.js/Vercel | Quy mô nhỏ, 1 repo, tách domain-adapter đủ sạch | Microservices | Ít cô lập triển khai hơn | Đơn giản vận hành; dễ test domain |
| ADR-20260706231719-02 | Fan-out qua **QueueAdapter** (QStash nếu có `QSTASH_TOKEN`, fallback `waitUntil` tuần tự) | Vercel không chạy nền sau response; tránh timeout | 1 cron đồng bộ / cron ngoài | Thêm phụ thuộc tùy chọn | "Trả về ngay + chạy nội bộ" đúng ý FRD; co giãn theo env |
| ADR-20260706231719-03 | Idempotency key `(date, categoryId, step)` + unique index | Vercel cron có thể retry/chạy 2 lần | Khóa phân tán/lock | Cần thiết kế upsert cẩn thận | Không gửi/ghi trùng |
| ADR-20260706231719-04 | **Adapter Registry theo env** (thiếu key ⇒ loại adapter) | Đúng yêu cầu "không hardcode, thiếu key thì bỏ" | Bật/tắt bằng flag DB | Cấu hình ở 2 nơi nếu không kỷ luật | Bật/tắt/ thêm nguồn không sửa lõi |
| ADR-20260706231719-05 | Ranking = `w_rel·relevance + w_eng·engagementNorm`, trọng số qua env; engagement chuẩn hóa theo platform | Kết hợp AI + tương tác (FRD) | Chỉ AI / chỉ engagement | Cần tinh chỉnh trọng số | Minh bạch, cấu hình được, test được |
| ADR-20260706231719-06 | Lịch cron đặt trong `vercel.json` theo **UTC** (23:00 & 23:30 = 06:00 & 06:30 ICT); TZ hiển thị qua env | Vercel Cron chỉ nhận UTC | Cron ngoài theo TZ | Đổi TZ phải sửa vercel.json | Tài liệu hóa rõ; validate lệch |
| ADR-20260706231719-07 | TTL index theo `NEWS_RETENTION_DAYS`, ràng buộc `retention ≥ dedupWindow` | Kiểm soát dung lượng + đảm bảo dedup | Xóa thủ công/cron dọn | Cần cấu hình đúng | Dữ liệu tự dọn, dedup an toàn |
| ADR-20260706231719-08 | Auth: NextAuth Credentials (admin seed env) + secret cho cron/worker | Tách kênh người-máy | Basic Auth / chỉ token | Cần cấu hình NextAuth | Bảo mật đúng ranh giới |
| ADR-20260706231719-09 | Nhà cung cấp email qua `MailAdapter` (v1: Gmail SMTP/nodemailer) | GĐ1 gửi cá nhân | Resend/SES ngay | Gmail giới hạn ~500/ngày | Dễ đổi provider khi scale |
| ADR-20260707223448-01 | Nguồn AI = Claude Messages API + web_search tool (thay Perplexity) | Người dùng đã có Claude key; hợp nhất provider | Giữ Perplexity / cả hai | Web search tính phí riêng | Adapter `claude` trong Registry |
| ADR-20260707223448-02 | Model qua env `CLAUDE_MODEL` (mặc định claude-opus-4-8) | Không hardcode | Hardcode model | Thêm 1 biến env | Linh hoạt chọn tier |
| ADR-20260707223448-03 | Dùng `web_search_20250305` (SDK 0.70.1 type sẵn) | SDK chưa type `_20260209` | Nâng SDK ngay | Chưa có dynamic filtering | Type-safe trên opus-4-8 |

# Quality Attribute Assessment

| Thuộc tính (ISO 25010) | Đánh giá | Kịch bản chất lượng | Mức rủi ro |
|------------------------|----------|---------------------|------------|
| Security | Trọng yếu | Kẻ lạ gọi `/api/cron/*` → bị secret chặn 401 | `[CRITICAL]` |
| Performance | Đủ nếu fan-out | 30 category thu thập trong ngân sách worker riêng | `[HIGH]` |
| Reliability | Có retry/fallback | 1 adapter chết vẫn ra bản tin từ adapter khác | `[HIGH]` |
| Availability | Cron-driven, không realtime | 06:30 mà 06:00 fail → alert, không gửi rỗng | `[MEDIUM]` |
| Scalability | OK giai đoạn 1 | 10→100 cat cần throttle quota | `[HIGH]` |
| Maintainability | Tốt nếu giữ domain thuần | Thêm nguồn mới = thêm 1 adapter | `[MEDIUM]` |
| Testability | Tốt | Ranking/dedup unit-test không cần mạng | `[MEDIUM]` |
| Operability | Cần dashboard runs | Admin xem status/logs mỗi ngày | `[MEDIUM]` |
| Observability | Cần bổ sung | Có structured log + alert email | `[HIGH]` |

# Open Questions

> Không còn Open Question **chặn**. Các mục dưới là quyết định-mặc-định (cấu hình được), không chặn code:
1. ✅ Hàng đợi: mặc định QStash nếu có `QSTASH_TOKEN`, không thì `waitUntil` tuần tự (ADR-02) — có thể đổi ở bước code nếu người dùng muốn Inngest.
2. ✅ Provider AI cho relevance: **Claude API + web search tool** (i-20260707223448 thay thế: trước là Perplexity); model qua env `CLAUDE_MODEL` (mặc định claude-opus-4-8).
3. 🟡 Chuẩn hóa engagement cụ thể (min-max vs z-score vs percentile) — chốt phương pháp ở /tn-code, mặc định **min-max theo platform**; không chặn thiết kế.
4. 🟡 Digest 1 email/category (giả định [A6]) — giữ nguyên trừ khi người dùng đổi ở bước sau.

# Architecture Recommendations

- `[Ưu tiên 1 — Security]` Guard tuyệt đối `/api/cron/*`, `/api/worker/*` bằng secret/chữ ký; guard mọi route admin bằng session. Không log secret.
- `[Ưu tiên 2 — Boundary]` Giữ **domain core (collect/rank/dedup/digest) thuần**, adapter cắm qua interface `NewsSourceAdapter`/`MailAdapter`/`QueueAdapter`/`Repository`.
- `[Ưu tiên 3 — Integration]` Adapter Registry theo env (thiếu key ⇒ loại); mọi adapter có retry + timeout + fallback + đếm lỗi (circuit breaker mềm).
- `[Ưu tiên 4 — Idempotency/Reliability]` Unique index cho `(date,categoryId,step)` và `(date,categoryId,email)`; worker upsert guard trạng thái.
- `[Ưu tiên 5 — Data Lifecycle]` TTL index theo retention, ràng buộc `retention ≥ dedupWindow`, validate env lúc khởi động.
- `[Ưu tiên 6 — Observability]` Structured log mỗi run + alert email admin cho các kịch bản fail/partial/no-adapter/collect-chưa-xong.
- `[Ưu tiên 7 — Scalability]` Chuẩn bị đường nâng cấp: QStash throttle + email provider chuyên dụng + unsubscribe bắt buộc khi mở nhiều người nhận.
