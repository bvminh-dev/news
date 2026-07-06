---
integration: i-20260706231719-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: plan
status: approved
open_questions: 0
updated: 2026-07-06
---

# Tổng Quan & Phạm Vi

Kế hoạch hiện thực ứng dụng **Bản tin hàng ngày** (Next.js App Router + Vercel + MongoDB) theo frd/tech/security/test của `i-20260706231719-ban-tin-hang-ngay`.

**Phạm vi code:**
1. Nền tảng: dự án Next.js, **config/env loader (không hardcode)**, kết nối MongoDB + models + indexes.
2. **Domain core thuần** (Hexagonal): validation (zod), chuẩn hóa URL/dedup, window 24h, ranking (relevance+engagement), selectTopN, DTO, idempotency-key, sanitize, SSRF-guard.
3. **Adapters**: NewsSource (Perplexity/Firecrawl/Apify) qua Registry-theo-env; Mail (Gmail SMTP); Queue (QStash/waitUntil).
4. **Pipelines**: collect (06:00, fan-out, idempotent, run-state) · send (06:30, không gửi rỗng, idempotent).
5. **Admin**: Auth (NextAuth Credentials + guard) · API CRUD danh mục/email · UI quản trị (data-testid) · preview · run-now · runs/logs.
6. **Public**: unsubscribe theo token.
7. **Bảo mật & vận hành**: guard tập trung, CSP/headers, rate-limit, error handler generic, structured log + alert admin, vercel.json cron (UTC), `.env.example`, `.gitignore`.
8. **Tests**: Unit (UT-01..20), Functional (FT-01..13), E2E scaffolding theo locator (E2E-01..04).

**Ngoài phạm vi:** NotebookLM; multi-tenant; email provider chuyên dụng/double opt-in; test tải; template email cầu kỳ.

# Danh Sách Task

| Task | Mô tả | Phụ thuộc | Tham chiếu (frd/tech/security/test) | Tiêu chí Done |
|------|-------|-----------|--------------------------------------|----------------|
| **T1** | Khởi tạo Next.js (App Router, TS) + cấu trúc thư mục Hexagonal (`domain/`, `adapters/`, `app/api`, `lib/config`). `.gitignore` chặn `.env*`, thêm `.env.example` (không giá trị thật). | — | tech §Architecture Pattern; security §Secret Mgmt | Build chạy; `.env*` bị ignore; `.env.example` liệt kê mọi biến |
| **T2** | **Config/env loader** + `validateConfig()` fail-fast (không in giá trị); ràng buộc `retention ≥ dedupWindow`; đọc TZ/lang/topN/trọng số/dedupWindow/retention. | T1 | frd [A1][A2][A4]; tech ADR-07; security §Secret Mgmt; test UT-15 | UT-15 pass; thiếu env bắt buộc → báo lỗi rõ, không lộ giá trị |
| **T3** | **MongoDB**: kết nối (TLS, cache client) + models `categories/subscribers/news_items/digest_runs/delivery_logs/admin_users` + indexes: unique `(categoryId,normalizedUrl)`, `(categoryId,fingerprint,date)`, `(date,categoryId,step)`, `(date,categoryId,email)`, TTL theo retention. | T2 | tech §Aggregate/§Data Lifecycle; test Regression(indexes) | Index tạo đúng; kết nối tái dùng; TTL hoạt động |
| **T4** | **Zod schemas** (validation lõi): category(name/keywords/scope/topN/lang), subscriber(email), config; chặn NoSQL operator từ client. | T2 | frd §Validation; security §Injection; test UT-10..14 | UT-10..14 pass; object `{$ne}` bị từ chối |
| **T5** | **Domain: dedup** — `normalizeUrl()`, `buildFingerprint()`, `dedup()` (trong-run + hàm so window). | T1 | frd §Business Rule(chống trùng); tech §Domain; test UT-01..03 | UT-01..03 pass |
| **T6** | **Domain: window 24h** — `isInWindow24h()` chuẩn hóa UTC. | T1 | frd Logic-thiếu(mốc 24h); test UT-04,05 | UT-04,05 pass |
| **T7** | **Domain: ranking** — `normalizeEngagement()` (min-max/platform), `computeFinalScore()` (trọng số env), `selectTopN()` (đủ/thiếu). | T2 | frd §Xếp hạng; tech ADR-05; test UT-06..09 | UT-06..09 pass; trọng số đọc từ config |
| **T8** | **NewsSource adapters + Registry**: interface `NewsSourceAdapter`; Perplexity/Firecrawl/Apify với retry/timeout/fallback/circuit-breaker mềm; ACL map→NewsItem; **SSRF guard** (`isPublicUrl`); Registry build theo env (thiếu key⇒loại). | T4,T5,T6 | frd §Tích hợp/AT-2; tech ADR-04/§Integration; security §SSRF; test UT-16,18,FT-08 | UT-16,18 pass; thiếu key⇒adapter vắng; URL nội bộ bị chặn |
| **T9** | **Mail adapter** (Gmail SMTP/nodemailer) + `sendAlert(admin)`; `sanitizeContent()` khi render nội dung nguồn. | T2 | frd §Thông báo; tech ADR-09; security §XSS; test UT-17 | UT-17 pass; gửi test OK; không render HTML thô |
| **T10** | **Queue adapter**: QStash nếu có `QSTASH_TOKEN` (verify chữ ký), fallback `waitUntil` tuần tự. | T2 | tech ADR-02; test FT-13(qstash absent) | Có/không token đều chạy; fallback đúng |
| **T11** | **Collect pipeline + routes**: `/api/cron/collect` (secret→202→fan-out), `/api/worker/collect` (verify→idempotent). Ghi `news_items`+`digest_runs` (run-state); alert khi no-adapter/fail. | T3,T7,T8,T10,T9 | frd Luồng B/EX-1,2,4; tech §Event/§Idempotency; test FT-07,09,10,11,UT-20 | FT-07,09,10,11 pass; chạy 2 lần no-op |
| **T12** | **Send pipeline + routes**: `/api/cron/send` + `/api/worker/send`; **chỉ gửi khi `collected`** (không gửi rỗng); render digest; ghi `delivery_logs`; retry người nhận lỗi; idempotent `(date,cat,email)`. | T3,T9,T10,T11 | frd Luồng C/EX-3,4; tech §Idempotency; test FT-12,13 | FT-12,13 pass; failed→không gửi; gửi lại no-op |
| **T13** | **Auth admin**: NextAuth Credentials, seed admin từ env (bcrypt), cookie HttpOnly/Secure/SameSite; **middleware guard** `/api/admin/*` + `/api/cron|worker/*` (secret). | T2,T3 | frd §Phân quyền; tech ADR-08/§Auth; security §Auth/BAC/§Session; test FT-01,02,E2E-02 | FT-01,02 pass; mọi method admin không session→401 |
| **T14** | **Admin API categories** CRUD (zod, DTO loại field nhạy cảm, audit change-history). | T4,T13 | frd §CRUD danh mục; security §Data Leakage/API3; test FT-03,06 | FT-03,06 pass; response không chứa hash/token |
| **T15** | **Admin API subscribers** CRUD (định dạng, chống trùng `(categoryId,email)`, DTO). | T4,T13 | frd §CRUD email; security §Data Leakage; test FT-04,05,06 | FT-04,05 pass |
| **T16** | **Public unsubscribe**: route `/api/public/unsubscribe/:token`, token ngẫu nhiên ≥128-bit, chỉ set active=false, phản hồi generic. | T3,T4 | frd §Thông báo(unsub); security §Data Leakage/§Authz; test FT-13,E2E-04 | Token đúng→tắt; sai→generic |
| **T17** | **Admin UI** (Next.js): trang đăng nhập, danh sách+form danh mục, panel email, run-now, preview (escape), trang Runs/Logs — gắn **mọi `data-testid`** theo E2E Locators. | T13,T14,T15,T11,T12 | frd Luồng A; test §E2E Locators, E2E-01,03,04 | Đủ testid; luồng E2E-01,03,04 thao tác được |
| **T18** | **Security hardening**: security headers + CSP, **rate-limit** (login/unsubscribe/run-now), error handler generic (prod), kiểm Origin/CSRF cho mutation, không log secret/PII. | T13,T16,T17 | security §Misconfig/§CSRF/§Data Leakage/§Monitoring | Header/CSP có; 429 khi vượt; lỗi 500 không lộ stack |
| **T19** | **Observability**: structured logging mỗi run (không secret), alert email admin (no-adapter/collect-fail/partial/collect-chưa-xong-lúc-gửi/send-fail), dữ liệu cho trang Runs. | T9,T11,T12 | tech §Observability; security §Monitoring/§Security Event; test FT-09,12 | Log có runId/counts; alert gửi đúng kịch bản |
| **T20** | **Scheduling & config triển khai**: `vercel.json` 2 cron `0 23 * * *` & `30 23 * * *` (UTC=06:00/06:30 ICT), tài liệu lệch TZ; hoàn thiện `.env.example`. | T11,T12 | tech ADR-06; frd [A5] | Cron cấu hình đúng UTC; README/`.env.example` đủ |
| **T21** | **Tests hiện thực**: Unit (UT-01..20), Functional (FT-01..13) với DB in-memory/thật + mock hệ ngoài; scaffolding E2E theo testid (không sinh code automation — chỉ đảm bảo locator tồn tại & luồng chạy tay được). Back-prop locator nếu đổi. | T5,T6,T7,T4,T8..T17 | test §toàn bộ + §Ma trận truy vết; CONVENTION §7 | UT/FT pass; testid khớp bảng; cập nhật ngược test.md nếu lệch |

# Đồ Thị Phụ Thuộc

```
T1 → T2 → T3
        ├→ T4 → (T5,T6,T7 độc lập nhau, đều cần T1/T2)
        ├→ T9, T10, T13
T4,T5,T6 → T8
T3,T7,T8,T9,T10 → T11 → T12
T2,T3 → T13 → {T14, T15, T16}
T14,T15,T11,T12,T13 → T17 → T18
T9,T11,T12 → T19
T11,T12 → T20
tất cả (T4..T17) → T21
```

**Đường găng (critical path):** `T1 → T2 → T3 → T4 → T8 → T11 → T12 → T17 → T18 → T21`.

**Có thể song song:** (T5,T6,T7) sau T2; (T9,T10) sau T2; (T14,T15,T16) sau T13.

# Tiêu Chí Done Tổng (Checklist nghiệm thu)

**Chức năng**
- [ ] CRUD danh mục + email qua UI admin (data-testid đủ) — E2E-01,03.
- [ ] Collect 06:00 fan-out, Top N/danh mục, dedup, run-state — FT-07,10,11.
- [ ] Send 06:30 chỉ khi `collected`, không gửi rỗng, idempotent — FT-12.
- [ ] Adapter registry theo env (thiếu key⇒loại) — FT-08,09.
- [ ] Unsubscribe theo token — FT-13, E2E-04.

**Bảo mật (mọi mitigation security.md đã xử lý)**
- [ ] Guard mọi `/api/admin/*` (session) + `/api/cron|worker/*` (secret) × mọi method — FT-02, E2E-02.
- [ ] Secrets chỉ ENV; `.env*` ignored; validate env fail-fast; không log secret/PII.
- [ ] zod chống NoSQLi — FT-05, UT-10.
- [ ] Sanitize/escape nội dung nguồn + CSP — UT-17, E2E-04.
- [ ] SSRF guard Firecrawl — UT-18.
- [ ] DTO loại field nhạy cảm — UT-19, FT-06.
- [ ] Cookie flags + rate-limit + error handler generic — T18.

**Kiểm thử (mọi test case có cách kiểm chứng)**
- [ ] Unit UT-01..20 pass.
- [ ] Functional FT-01..13 pass (DB + mock hệ ngoài).
- [ ] E2E-01..04 thao tác được theo testid (locator khớp, back-prop nếu đổi).
- [ ] Ma trận truy vết: mọi yêu cầu FRD có tầng phủ.

**Vận hành**
- [ ] `vercel.json` cron UTC đúng (06:00/06:30 ICT); TZ/lang/topN/trọng số/dedup/retention qua env.
- [ ] Structured log + alert admin cho các kịch bản fail/partial/no-adapter.
- [ ] **Không còn open question chặn** (điều kiện vào /tn-code).

# Rủi Ro & Giả Định

**Rủi ro (kéo từ các doc):**
- `[CRITICAL]` Quên guard 1 method route admin/worker → vượt quyền/spam/đốt quota (T13,T18 + FT-02).
- `[CRITICAL]` Lộ secret qua log/error/response (T2,T14,T18).
- `[HIGH]` Timeout serverless khi nhiều danh mục → fan-out per-category + queue (T10,T11).
- `[HIGH]` Dedup theo URL thô → tin trùng (T5).
- `[HIGH]` Send không kiểm run-state → email rỗng (T12).
- `[MEDIUM]` XSS nội dung nguồn / SSRF Firecrawl (T9,T8,T18).

**Giả định (không chặn, chốt khi code):**
- Công thức chuẩn hóa engagement mặc định **min-max theo platform** (T7; cập nhật UT-06,07 nếu đổi).
- CSRF: SameSite + kiểm Origin/token (T18).
- Digest **1 email/danh mục** (frd [A6]).
- Queue mặc định QStash nếu có token, fallback waitUntil (T10).
- Provider AI cho relevance = **Perplexity** (dùng lại key).

# Ghi Chú Cho /tn-code (Gate cứng)

- Gate cứng chặn nếu bất kỳ doc {frd,tech,security,test,plan} chưa `approved` hoặc `open_questions > 0` — hiện **tất cả đã approved, open_questions = 0** ⇒ đủ điều kiện vào code.
- Ưu tiên thực thi theo đường găng; hoàn thành T13/T18 (bảo mật) trước khi expose UI thật.
- **Back-prop locator**: nếu đổi `data-testid` so với bảng E2E Locators → cập nhật ngược `test.md` (+ cascade).
