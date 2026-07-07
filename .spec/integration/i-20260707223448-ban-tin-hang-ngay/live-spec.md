# Live-spec — i-20260707223448-ban-tin-hang-ngay

## [2026-07-07] /tn-yeu-cau (i-20260707223448-ban-tin-hang-ngay)
- Skill dùng: phan-tich-nghiep-vu.
- Việc đã làm: Ghi frd delta — thay nguồn AI thu thập Perplexity → Claude API (web search tool). Cascade lên main frd + feature-index.
- Quyết định/giả định: bỏ PERPLEXITY_API_KEY → ANTHROPIC_API_KEY + CLAUDE_MODEL (mặc định claude-opus-4-8); thiếu key ⇒ loại adapter; Firecrawl/Apify giữ nguyên; web search max_uses=5/danh mục.
- Lệch so với plan/spec: Code đã hiện thực TRƯỚC tài liệu (theo yêu cầu trực tiếp của người dùng); pipeline này back-document để đồng bộ.
- Kết quả: frd approved, open_questions = 0. Bước kế /tn-thiet-ke.

## [2026-07-07] /tn-thiet-ke (i-20260707223448-ban-tin-hang-ngay)
- Ghi tech delta: ClaudeAdapter thay PerplexityAdapter (Messages API + web_search_20250305). 3 ADR mới. Cascade lên main tech + sad. tech approved, open_questions = 0.

## [2026-07-07] /tn-bao-mat (i-20260707223448-ban-tin-hang-ngay)
- security delta: ANTHROPIC_API_KEY chỉ ENV (thay Perplexity key); web search do Anthropic thực thi server-side (không tăng SSRF); giám sát chi phí web search; sanitize nội dung nguồn. Cascade lên main security. approved.

## [2026-07-07] /tn-kiem-thu + /tn-sinh-test (i-20260707223448-ban-tin-hang-ngay)
- test delta: TC-D1..D6 + phân tầng (UT-16a/b/c registry theo env; FT-08' collect Claude BLOCKED do cần key+mạng). Cascade lên main test (rename perplexity→claude + merge note). approved.

## [2026-07-07] /tn-ke-hoach (i-20260707223448-ban-tin-hang-ngay)
- plan: 7 task D1..D7 (env, config, ClaudeAdapter, registry, sdk, test, verify) + tiêu chí Done. approved. Code đã hiện thực trước → /tn-code chỉ đối chiếu.

## [2026-07-07] /tn-code (i-20260707223448-ban-tin-hang-ngay)
- GATE CỨNG PASS. Code đã hiện thực: config (anthropicKey/claudeModel), src/adapters/news/claude.ts (web_search_20250305), registry (ClaudeAdapter), xóa perplexity.ts, .env.example. Verify: tsc sạch, vitest 46/46 PASS, next build OK. code = done. Không back-prop locator (không đổi UI).

## [2026-07-07] /tn-bao-cao + /tn-review (i-20260707223448-ban-tin-hang-ngay)
- Report: 3 PASS (UT-16a/b/c) / 0 FAIL / 1 BLOCKED (FT-08' collect Claude live cần key). 0 defect. Cascade (merge) vào main report.
- Review: không có bug CRITICAL/HIGH. Ghi nhận [LOW] pause_turn có thể nhân số lần web search (bounded guard≤5 × max_uses=5); hiếm, chấp nhận — theo dõi chi phí. review = done.

## [2026-07-07] Bổ sung auth-mode (i-20260707223448-ban-tin-hang-ngay)
- ClaudeAdapter tự nhận diện credential: sk-ant-api... → x-api-key (SDK mặc định); sk-ant-oat... → Authorization: Bearer + header beta oauth-2025-04-20 (đặt apiKey:null để không gửi kèm x-api-key).
- Phát hiện (verify thật): OAuth token Claude Code (sk-ant-oat) auth QUA được (hết 401) nhưng bị Anthropic trả 429 rate_limit_error nhất quán ⇒ token subscription KHÔNG dùng được cho Messages API lập trình. Kết luận: cần API key thật (sk-ant-api03-...) để app chạy. Code hỗ trợ cả hai (phương án A theo người dùng chọn).

## [2026-07-07] Bổ sung env ANTHROPIC_AUTH_TOKEN + back-document (i-20260707223448-ban-tin-hang-ngay)
- Skill dùng: (đồng bộ tài liệu ↔ code).
- Việc đã làm: Wire xác thực bằng token ở lớp config/registry (trước đó chỉ adapter tự nhận diện qua ANTHROPIC_API_KEY):
  - `config.ts`: thêm `tools.anthropicAuthToken` đọc từ env `ANTHROPIC_AUTH_TOKEN`.
  - `registry.ts`: `ToolKeys.anthropicAuthToken?` (optional); dựng `ClaudeAdapter` với `anthropicAuthToken || anthropicKey` — **ưu tiên token**.
  - `.env.example`: tài liệu 2 phương thức xác thực + cảnh báo token ngắn hạn.
  - `tests`: thêm UT-16d (chỉ token → 1 adapter claude) + UT-16e (cả hai → ưu tiên token).
- Quyết định/giả định: ưu tiên token nếu có cả hai; adapter đã sẵn route sk-ant-oat→Bearer+beta oauth-2025-04-20 (không đổi). Giữ khuyến cáo dùng API key thật (token subscription bị 429).
- Lệch so với plan/spec: bổ sung task D8 vào plan; cập nhật frd (A1/A4, EX-4/5), tech (ADR-04/05, Authentication Review), security (asset + secret mgmt), test (TC-D7/D8, UT-16d/e).
- Kết quả test: vitest **48/48 PASS**, `tsc --noEmit` sạch. Không đổi UI → không back-prop locator.

## [2026-07-07] Đổi cơ chế gọi Claude: spawn CLI headless (i-20260707223448-ban-tin-hang-ngay)
- Skill/nguồn: theo hướng dẫn HUONG-DAN-PER-PROJECT-CLAUDE-KEY.md (§5 spawn `claude -p`).
- Vấn đề: token subscription `sk-ant-oat` bị `429 rate_limit_error` khi gọi thẳng Messages API qua SDK (`@anthropic-ai/sdk`).
- Việc đã làm: viết lại `src/adapters/news/claude.ts` — bỏ SDK, **spawn `claude` CLI headless** (`claude -p --model <m> --permission-mode plan [--bare]`); bơm credential qua ENV (`sk-ant-oat`→`CLAUDE_CODE_OAUTH_TOKEN`; `sk-ant-api`→`ANTHROPIC_API_KEY`+`--bare`); xoá ENV auth kế thừa + `CLAUDE_CONFIG_DIR` tạm riêng (dọn trong finally); prompt qua stdin; timeout `CLAUDE_CLI_TIMEOUT_MS`(180s)+SIGKILL; parse JSON array bằng quét ngoặc cân bằng; phân loại lỗi auth/quota (gộp stdout+stderr). `.env.example` cập nhật (CLI, CLAUDE_CLI_BIN/TIMEOUT, cảnh báo Vercel). Registry/config không đổi.
- Verify THẬT (không chỉ khai báo): `npx tsx` gọi `ClaudeAdapter.search()` với token `sk-ant-oat` từ `.env`, model `claude-sonnet-4-6` → **3 tin hợp lệ (title/url/relevance), 94.5s, hết 429**. vitest 48/48 PASS, tsc sạch.
- Quyết định: ADR-06 supersede ADR-01 (SDK) + ADR-05. `[HIGH]` **Ràng buộc: không chạy Vercel serverless** (cần binary + spawn) → deploy tự host/long-running. `@anthropic-ai/sdk` không còn dùng (có thể gỡ sau).
