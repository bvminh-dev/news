---
integration: i-20260707223448-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: report
status: draft
open_questions: 0
updated: 2026-07-07
---

# Tóm Tắt Lần Chạy
Delta Perplexity → Claude; xác thực bằng `ANTHROPIC_AUTH_TOKEN`; **đổi cơ chế gọi: spawn `claude` CLI headless** (thay SDK Messages API) để token subscription `sk-ant-oat` chạy được (hết 429). Ngày chạy: 2026-07-07. Runner: vitest **48/48 PASS**, `tsc --noEmit` sạch, **verify adapter live PASS**.

| Chỉ số | Unit | Functional | E2E | Tổng |
|--------|------|------------|-----|------|
| Tổng case (delta) | 5 (UT-16a..e) | 2 (FT-CLI-LIVE, FT-08') | 0 | 7 |
| PASS | 5 | 1 | 0 | 6 |
| FAIL | 0 | 0 | 0 | 0 |
| BLOCKED | 0 | 1 | 0 | 1 |

# Môi Trường & Runner
Next.js 15.5.20; `claude` CLI 2.1.202 (Claude Code). `npx vitest run` (**48/48**), `npx tsc --noEmit` (sạch). Verify adapter live: `npx tsx` gọi `ClaudeAdapter.search()` với token thật (`sk-ant-oat`), model `claude-sonnet-4-6`.

# Kết Quả Theo Test Case
| Case | Loại | Expected | Actual | Trạng thái |
|------|------|----------|--------|------------|
| UT-16a | unit | 3 adapter khi đủ key | đúng | PASS |
| UT-16b | unit | 1 adapter name="claude" khi chỉ ANTHROPIC_API_KEY | đúng | PASS |
| UT-16c | unit | 0 adapter khi không key | đúng | PASS |
| UT-16d | unit | 1 adapter claude khi chỉ ANTHROPIC_AUTH_TOKEN | đúng | PASS |
| UT-16e | unit | 1 adapter claude khi có cả key lẫn token (ưu tiên token) | đúng | PASS |
| FT-CLI-LIVE | func | adapter spawn CLI trả tin 24h + relevance | token sk-ant-oat → **3 tin hợp lệ, 94.5s** (hết 429) | PASS |
| FT-08' | func | collect qua pipeline DB (engagement=0, tools=[claude]) | cần credential+mạng+Mongo (CI); adapter đã chứng minh | BLOCKED |

# Defect Phát Hiện
Không phát hiện (0 FAIL).

# E2E & Locator
Không đổi UI → không có E2E mới, không back-prop locator.

# Coverage & Khoảng Hở
- Adapter-live (spawn CLI) đã verify PASS với token thật ⇒ đường then chốt (429 fix) đã chứng minh.
- `[MEDIUM]` FT-08' (collect qua pipeline DB) vẫn BLOCKED CI — chạy khi có credential + mạng + Mongo.
- `[LOW]` Chưa có unit cô lập mock `spawn` cho các nhánh lỗi (exit≠0, timeout, ENOENT); đề xuất bổ sung nếu cần độ phủ cao.

# Case Chưa Chạy Được (BLOCKED)
- FT-08' — full pipeline DB cần credential+mạng+Mongo trong CI. Adapter đã chứng minh ở FT-CLI-LIVE.

# Kết Luận & Khuyến Nghị
- **GO cho delta** ở mức dev: registry (key/token) PASS, typecheck sạch, **adapter live PASS** (token oat → 3 tin), không defect.
- `[HIGH]` **Ràng buộc triển khai**: adapter spawn `claude` CLI ⇒ **không chạy trên Vercel serverless**. Deploy ở môi trường tự host/long-running (VPS/container) có cài `@anthropic-ai/claude-code`. Cân nhắc lại kiến trúc hosting (tech.md ADR-002 giả định Vercel).
- `[MEDIUM]` Độ trễ ~90s+/danh mục: theo dõi tổng thời lượng worker (maxDuration 300s); nhiều danh mục cần queue/nới thời lượng.
