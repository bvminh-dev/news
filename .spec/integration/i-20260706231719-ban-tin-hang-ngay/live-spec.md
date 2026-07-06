# Live-spec — i-20260706231719-ban-tin-hang-ngay

## [2026-07-06] /tn-yeu-cau (i-20260706231719-ban-tin-hang-ngay)
- Skill dùng: phan-tich-nghiep-vu (BABOK, checklist 16 khía cạnh).
- Việc đã làm: Bootstrap .spec (CONVENTION, registry). Phân tích yêu cầu ứng dụng Bản tin hàng ngày; hỏi làm rõ 2 vòng (7 câu). Ghi frd.md 19 mục.
- Quyết định/giả định:
  - Công cụ: Perplexity + Apify + Firecrawl (thiếu env key ⇒ bỏ qua công cụ). NotebookLM ngoài phạm vi (không API).
  - Lịch: 6:00 thu thập (trả về ngay, chạy nội bộ, lưu DB) → 6:30 gửi email. TZ/ngôn ngữ cấu hình env (mặc định ICT + tiếng Việt).
  - Auth admin bắt buộc cho CRUD danh mục + email. Cron endpoint bảo vệ bằng secret.
  - Email giai đoạn 1: Gmail SMTP cá nhân → email cá nhân. Xếp hạng nổi bật = AI + engagement. Lưu lịch sử + chống trùng (window qua env).
  - Giả định [A6]: mặc định 1 email/danh mục (có thể đổi gộp ở thiết kế).
- Lệch so với plan/spec: Không.
- Kết quả test/locator/bug: Chưa (bước 1). open_questions = 0, status = approved.

## [2026-07-06] /tn-thiet-ke (i-20260706231719-ban-tin-hang-ngay)
- Skill dùng: thiet-ke-he-thong (TOGAF/DDD/C4/STRIDE, template 28 mục).
- Việc đã làm: Ghi tech.md 28 mục. Chốt Modular Monolith + Hexagonal trên Next.js/Vercel + MongoDB. 9 ADR.
- Quyết định/giả định:
  - Fan-out qua QueueAdapter: QStash nếu có QSTASH_TOKEN, fallback waitUntil tuần tự (ADR-02) — hiện thực "trả về ngay + chạy nội bộ".
  - Idempotency key (date,categoryId,step) + (date,categoryId,email); TTL retention ≥ dedupWindow.
  - Adapter Registry theo env (thiếu key ⇒ loại). Ranking = w_rel·relevance + w_eng·engagementNorm (trọng số env), AI dùng lại Perplexity.
  - Cron trong vercel.json theo UTC (23:00/23:30 = 06:00/06:30 ICT). Auth: NextAuth Credentials + CRON_SECRET/chữ ký QStash.
  - Collections: categories, subscribers, news_items, digest_runs, delivery_logs, admin_users.
- Lệch so với plan/spec: Không. open_questions = 0, status = approved.
- Kết quả test/locator/bug: Chưa (bước 2). Tạo sad.md hợp nhất.

## [2026-07-06] /tn-bao-mat (i-20260706231719-ban-tin-hang-ngay)
- Skill dùng: bao-mat-he-thong (STRIDE + OWASP Top 10 + API Top 10 + Zero Trust, template 27 mục).
- Việc đã làm: Ghi security.md 27 mục. Nhấn mạnh bề mặt Admin UI (CRUD danh mục + email/danh mục) theo lời nhắc người dùng.
- Quyết định/giả định:
  - Guard tập trung: session admin cho /api/admin/*, CRON_SECRET + chữ ký QStash cho /api/cron|worker/*, capability-token cho unsubscribe.
  - Bắt buộc: validate zod (chống NoSQL injection), không render HTML thô nguồn (chống XSS) + CSP, rate-limit login/unsubscribe/run-now, DTO loại field nhạy cảm, secrets chỉ ở ENV.
  - MFA khuyến nghị nhưng không bắt buộc GĐ1 (1 admin). CSRF: SameSite + kiểm Origin/token (chốt chi tiết ở /tn-code).
- Lệch so với plan/spec: Không. open_questions = 0, status = approved.
- Kết quả test/locator/bug: Chưa (bước 3). Tạo main/security.md hợp nhất + checklist go-live.

## [2026-07-06] /tn-kiem-thu (i-20260706231719-ban-tin-hang-ngay)
- Skill dùng: kiem-thu-phan-mem (ISTQB: EP/BVA/Decision Table/State Transition/Error Guessing, template 19 mục).
- Việc đã làm: Ghi test.md 19 mục + 22 test case mô tả bằng lời + bảng E2E Locators (data-testid) cho màn hình quản trị danh mục/email/runs/unsubscribe.
- Quyết định/giả định: test ưu tiên Risk-Based (Broken Access Control → idempotency/không gửi rỗng → dedup/topN/registry → validation/injection → integration/XSS/SSRF).
- Lệch so với plan/spec: Không. Lỗ hổng spec cần chốt ở /tn-code (không chặn): công thức chuẩn hóa engagement, cơ chế CSRF, template email.
- Kết quả test/locator/bug: E2E Locators đã tạo (~30 testid). test.md: approved, open_questions = 0.

## [2026-07-06] /tn-sinh-test (i-20260706231719-ban-tin-hang-ngay)
- Skill dùng: sinh-test-cases (Test Pyramid, phân tầng theo tầng rẻ nhất).
- Việc đã làm: Append vào test.md: 20 Unit + 13 Functional + 4 E2E = 37 case + ma trận truy vết (14 yêu cầu FRD) + khoảng trống. Pyramid khỏe mạnh (54/35/11%).
- Quyết định/giả định: đẩy toàn bộ logic thuần (dedup/ranking/window/validation/sanitize/SSRF/DTO) xuống Unit; luồng+DB+mock ở Functional; E2E chỉ happy-path admin + chặn truy cập + preview-escape + unsubscribe.
- Lệch so với plan/spec: Không. Khoảng trống: engagement formula (cập nhật UT-06,07 khi chốt), test tải, template email, tách CSRF/rate-limit case.
- Kết quả test/locator/bug: stage vẫn 'test', open_questions = 0.

## [2026-07-06] /tn-ke-hoach (i-20260706231719-ban-tin-hang-ngay)
- Skill dùng: tổng hợp (frd+tech+security+test).
- Việc đã làm: Ghi plan.md — 21 task (T1..T21) + đồ thị phụ thuộc + đường găng + tiêu chí Done tổng + rủi ro/giả định.
- Quyết định/giả định: đường găng T1→T2→T3→T4→T8→T11→T12→T17→T18→T21; hoàn thành T13/T18 (bảo mật) trước khi expose UI; giữ giả định min-max engagement, QStash-fallback-waitUntil, 1 email/danh mục.
- Lệch so với plan/spec: Không. plan.md không cascade.
- Kết quả test/locator/bug: plan.md approved, open_questions = 0 → đủ điều kiện vào /tn-code (gate cứng).

## [2026-07-07] /tn-code (i-20260706231719-ban-tin-hang-ngay)
- GATE CỨNG: 5 doc {frd,tech,security,test,plan} đều approved, open_questions=0 → PASS.
- Việc đã làm: hiện thực toàn bộ T1..T21 theo đường găng.
  - T1 scaffold Next.js 15 (App Router, TS) + next.config (CSP/headers) + vercel.json (cron 23:00/23:30 UTC=06:00/06:30 ICT) + .gitignore (chặn .env*) + .env.example.
  - T2 src/lib/config.ts (env loader, validateConfig fail-fast, retention≥dedup, không lộ secret). T3 src/lib/db.ts + src/models/index.ts (collections + indexes dedup/idempotency/TTL).
  - T4 src/domain/schemas.ts (zod chống NoSQLi). T5 dedup.ts. T6 window.ts. T7 ranking.ts. + sanitize.ts, ssrf.ts, dto.ts, idempotency.ts, slug.ts, types.ts.
  - T8 adapters/news/{types,perplexity,firecrawl,apify,registry}.ts (Registry theo env, SSRF guard, ACL). T9 adapters/mail.ts (Gmail SMTP + sendAlert). T10 adapters/queue.ts (QStash/fallback).
  - T11 services/collect.ts + fanout.ts + app/api/cron/collect + app/api/worker/collect (idempotent, run-state, alert). T12 services/send.ts + digest.ts + app/api/cron/send + app/api/worker/send (không gửi email rỗng, idempotent (date,cat,email)).
  - T13 auth/auth.ts (NextAuth Credentials, seed env, bcrypt) + lib/guard.ts (requireAdmin/requireCronSecret/verifyWorker/checkOrigin) + middleware.ts.
  - T14 api/admin/categories[/id] (CRUD + DTO + audit). T15 api/admin/categories/[id]/subscribers[/sid]. T16 api/public/unsubscribe/[token] (token, chỉ set active=false, phản hồi generic).
  - T17 app/login + app/dashboard + CategoryManager.tsx (đủ ~30 data-testid, confirm modal). + api/admin/runs + api/admin/categories/[id]/preview.
  - T18 CSP/headers (next.config), rate-limit (lib/rateLimit) cho run-now/unsubscribe, checkOrigin CSRF, error generic. T19 lib/logger.ts structured + maskEmail + alert. T20 vercel.json + scripts/seed-admin.ts.
  - T21 tests: 6 unit file (UT-01..20) + 1 functional (collect-pipeline) = 43 case.
- Kết quả chạy: `vitest run` → 43/43 PASS; `tsc --noEmit` → sạch; `next build` → 15 route compiled OK.
- Locator: hiện thực đúng 100% data-testid trong bảng E2E Locators (kể cả confirm-delete-btn dùng modal) → KHÔNG cần back-prop.
- Lệch so với plan: không. Giả định giữ nguyên (min-max engagement, QStash-fallback-waitUntil, 1 email/danh mục, relevance dùng Perplexity).

## [2026-07-07] /tn-bao-cao (i-20260706231719-ban-tin-hang-ngay)
- Skill dùng: chay-kiem-thu (thực thi + báo cáo trung thực).
- Việc đã làm: chạy vitest (43/43 PASS), tsc sạch, next build 15 route OK. Ghi report.md.
- Kết quả: Unit 20/20 PASS · Functional 2 PASS (FT-07,08) + 11 BLOCKED (thiếu MongoDB/SMTP) · E2E 4 BLOCKED (thiếu app+DB+browser; locator đã xác minh có). Tổng 22 PASS / 0 FAIL / 15 BLOCKED. 0 defect.
- Locator: không lệch → không back-prop. Conditional GO (dev); cần chạy Functional DB-backed + E2E trước production.
