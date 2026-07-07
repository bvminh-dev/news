# Live-spec — Nhật ký as-built hợp nhất (.spec/main)

## [2026-07-06] /tn-yeu-cau (i-20260706231719-ban-tin-hang-ngay)
- Khởi tạo hệ thống (greenfield). Thêm tính năng **ban-tin-hang-ngay**: thu thập Top N tin nổi bật 24h/danh mục qua Perplexity/Apify/Firecrawl → lưu MongoDB → gửi email theo lịch (6:00 thu thập, 6:30 gửi). Next.js + Vercel, admin auth, config qua env.
- frd.md: approved, open_questions = 0.

## [2026-07-06] /tn-thiet-ke (i-20260706231719-ban-tin-hang-ngay)
- Kiến trúc: Modular Monolith + Hexagonal (Next.js/Vercel + MongoDB). Fan-out per-category (QStash/waitUntil), 2 cron 06:00/06:30 ICT. 9 ADR. Tạo sad.md hợp nhất. tech.md: approved, open_questions = 0.

## [2026-07-06] /tn-bao-mat (i-20260706231719-ban-tin-hang-ngay)
- Bảo mật: STRIDE+OWASP. Guard admin session / cron secret / unsubscribe token; zod chống NoSQL injection; sanitize+CSP chống XSS; rate-limit; secrets chỉ ENV. Tạo main/security.md + checklist go-live. security.md: approved, open_questions = 0.

## [2026-07-06] /tn-kiem-thu (i-20260706231719-ban-tin-hang-ngay)
- Test design (ISTQB): 19 mục + 22 test case mô tả bằng lời + ~30 E2E Locators (data-testid) cho admin CRUD danh mục/email, runs, unsubscribe. Ưu tiên Risk-Based. test.md: approved, open_questions = 0.

## [2026-07-06] /tn-sinh-test (i-20260706231719-ban-tin-hang-ngay)
- Phân tầng Test Pyramid: 20 Unit + 13 Functional + 4 E2E + ma trận truy vết 14 yêu cầu FRD. Pyramid khỏe mạnh. Append vào test.md (stage giữ 'test').

## [2026-07-06] /tn-ke-hoach (i-20260706231719-ban-tin-hang-ngay)
- Plan: 21 task (T1..T21) + đồ thị phụ thuộc + đường găng + tiêu chí Done tổng. plan.md approved, open_questions = 0. Sẵn sàng /tn-code.

## [2026-07-07] /tn-code (i-20260706231719-ban-tin-hang-ngay)
- Hiện thực toàn bộ T1..T21 (Next.js 15 + MongoDB + NextAuth + adapters Perplexity/Firecrawl/Apify + Gmail SMTP + cron 06:00/06:30 ICT). Admin UI CRUD danh mục/email đủ data-testid.
- Kết quả: vitest 43/43 PASS · tsc sạch · next build 15 route OK. Không back-prop locator. code = done.

## [2026-07-07] /tn-bao-cao (i-20260706231719-ban-tin-hang-ngay)
- Report: 22 PASS / 0 FAIL / 15 BLOCKED (Functional DB-backed + E2E thiếu MongoDB/SMTP/browser). 0 defect. Conditional GO (dev); cần chạy Functional DB + E2E trước production. report = draft.

## [2026-07-07] /tn-review (i-20260706231719-ban-tin-hang-ngay)
- review-code phát hiện 4 bug: BUG-1 [CRITICAL] upsert conflict createdAt (collect không ghi được tin), BUG-2 [HIGH] index thiếu date đè lịch sử, BUG-3 [HIGH] login thiếu rate-limit, BUG-4 [MEDIUM] fanout maxDuration.
- Đã ghi bugfix.md + 5 rule vào CLAUDE.md, sửa code + thêm DB-backed test (mongodb-memory-server). vitest 46/46 PASS, tsc sạch. review = done.

## [2026-07-07] /tn-yeu-cau (i-20260707223448-ban-tin-hang-ngay)
- Delta: đổi nguồn AI thu thập Perplexity → Claude API (web search tool); PERPLEXITY_API_KEY → ANTHROPIC_API_KEY + CLAUDE_MODEL. Cascade lên frd + feature-index. frd approved, open_questions = 0. (Code đã hiện thực trước; pipeline back-document.)

## [2026-07-07] /tn-thiet-ke (i-20260707223448-ban-tin-hang-ngay)
- tech delta: ClaudeAdapter (web_search) thay Perplexity; 3 ADR mới; interface NewsSourceAdapter không đổi. approved.

## [2026-07-07] /tn-bao-mat (i-20260707223448-ban-tin-hang-ngay)
- security delta: ANTHROPIC_API_KEY chỉ ENV; guard cron/worker càng quan trọng (web search tốn phí); sanitize giữ nguyên. approved.

## [2026-07-07] /tn-kiem-thu (i-20260707223448-ban-tin-hang-ngay)
- test delta: registry theo env (anthropicKey) + parse/refusal/pause_turn + sanitize; rename perplexity→claude trong main test. UT-16 PASS. approved.

## [2026-07-07] /tn-ke-hoach (i-20260707223448-ban-tin-hang-ngay)
- plan delta: 7 task đổi Perplexity→Claude. approved.

## [2026-07-07] /tn-code (i-20260707223448-ban-tin-hang-ngay)
- Đổi Perplexity→Claude: config+adapter+registry+env. tsc sạch, 46/46 PASS, build OK. code = done.

## [2026-07-07] /tn-bao-cao + /tn-review (i-20260707223448-ban-tin-hang-ngay)
- Report 3P/0F/1B, 0 defect. Review: không bug CRITICAL/HIGH (1 ghi chú LOW: pause_turn × web search cost). review = done. Integration hoàn tất.

## [2026-07-07] Bổ sung xác thực token (i-20260707223448-ban-tin-hang-ngay)
- Thêm env `ANTHROPIC_AUTH_TOKEN` (OAuth Claude Code `sk-ant-oat` → Bearer + beta oauth-2025-04-20). `config.ts` đọc `tools.anthropicAuthToken`; `registry.ts` ưu tiên `anthropicAuthToken || anthropicKey`. Adapter đã sẵn nhận diện tiền tố (không đổi). `.env.example` tài liệu 2 cách xác thực.
- Cảnh báo (verify thật): token subscription bị `429 rate_limit_error` trên Messages API ⇒ vận hành cần API key thật; token vẫn hỗ trợ cho token có quyền Messages API.
- Test: +UT-16d/e (chỉ token / key+token ưu tiên token). Suite 48/48 PASS, tsc sạch. Cascade lên frd/tech/security/test + sad + security main.

## [2026-07-07] Đổi cơ chế gọi Claude: spawn CLI headless (i-20260707223448-ban-tin-hang-ngay)
- Token subscription `sk-ant-oat` bị `429` khi gọi thẳng Messages API (SDK) → viết lại `ClaudeAdapter` **spawn `claude` CLI headless** (`claude -p`, credential qua ENV `CLAUDE_CODE_OAUTH_TOKEN`/`ANTHROPIC_API_KEY`+`--bare`; config dir cô lập; `--permission-mode plan`; prompt stdin; timeout+SIGKILL; parse ngoặc cân bằng). ADR-06 supersede ADR-01.
- Verify thật: token oat → 3 tin, 94.5s (hết 429). vitest 48/48 PASS, tsc sạch. `@anthropic-ai/sdk` không còn dùng.
- `[HIGH]` Ràng buộc kiến trúc: cần binary + spawn ⇒ **KHÔNG chạy Vercel serverless** (mâu thuẫn ADR-002 fan-out) → deploy tự host/long-running. Cần rà lại quyết định hosting.

## [2026-07-08] Run-now: force re-collect + gửi email luôn (i-20260708000200-ban-tin-hang-ngay)
- Bối cảnh: user chạy run-now tưởng "không có kết quả" — thực ra DB có tin (endpoint chỉ trả counts); phát hiện tích lũy tin + rank trùng khi chạy lại.
- Hành vi mới (user chốt): "Chạy ngay" = **force re-collect**, tin mới re-rank lên đầu (rank 1..N), tin cũ cùng ngày đẩy xuống (+N, giữ cả hai); rồi **gửi email lại toàn bộ** subscriber (reset delivery_logs hôm nay). Email giới hạn top-N. Cron 06:00/06:30 KHÔNG đổi.
- Code: `collectCategory({force})` + `$inc rank`; `sendCategory` `.limit(topN)` + `resetDeliveries`; route run-now ghép collect→reset→send (guard: collect failed → không gửi).
- Verify: tsc sạch, vitest **50/50 PASS** (+FT-RN-1 shift rank, +FT-RN-2 send-limit). Run-now live (gửi email thật, 1 subscriber) để admin bấm — chưa tự chạy (side-effect ra ngoài).
- `[MEDIUM]` Run-now đồng bộ dài (collect CLI ~90s + send); theo dõi maxDuration 300s. Chạy ngay nhiều lần/ngày ⇒ tích lũy tin cũ (top-N vẫn đúng).
