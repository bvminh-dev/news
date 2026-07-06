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
