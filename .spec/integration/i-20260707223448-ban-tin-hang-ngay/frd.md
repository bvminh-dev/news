---
integration: i-20260707223448-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: frd
status: approved
open_questions: 0
updated: 2026-07-07
---

# Tóm Tắt Tính Năng

**Delta thay đổi nguồn AI thu thập:** thay **Perplexity API** bằng **Claude API (Anthropic)** dùng **web search tool** để tìm tin nổi bật 24h, tóm tắt và chấm điểm liên quan (relevance). Đây là thay đổi của tính năng `ban-tin-hang-ngay` (gốc: i-20260706231719).

> [i-20260707223448] thay thế: adapter AI-relevance từ Perplexity → Claude. Firecrawl và Apify **giữ nguyên**.

**Phạm vi (in-scope):**
- Bỏ `PERPLEXITY_API_KEY`; thêm `ANTHROPIC_API_KEY` + `CLAUDE_MODEL` (mặc định `claude-opus-4-8`) vào env.
- **2 phương thức xác thực Claude** (bổ sung `[i-20260707223448]`): env `ANTHROPIC_API_KEY` (API key `sk-ant-api...` → header `x-api-key`) **HOẶC** env `ANTHROPIC_AUTH_TOKEN` (OAuth token Claude Code `sk-ant-oat...` → `Authorization: Bearer` + beta `oauth-2025-04-20`). Nếu có cả hai, **ưu tiên `ANTHROPIC_AUTH_TOKEN`**. Registry dựng `ClaudeAdapter` nếu có **ít nhất một** trong hai.
- `ClaudeAdapter` thay `PerplexityAdapter`: **spawn `claude` CLI headless (`claude -p`)**, credential bơm qua ENV (CLI tự dùng WebSearch nội bộ) → trả JSON `{title,url,publishedAt,summary,relevance}`. Adapter tự nhận diện loại credential theo tiền tố. **Ràng buộc:** cần binary `claude` + spawn subprocess ⇒ không chạy Vercel serverless (dùng môi trường tự host/long-running).
- Giữ nguyên: Registry-theo-env (thiếu cả 2 ⇒ loại adapter), pipeline dedup/ranking/topN, gửi email, lịch, bảo mật admin.

**Ngoài phạm vi:** mọi phần khác của tính năng gốc (không đổi).

# Mục Tiêu Nghiệp Vụ

- **Business Goal:** Dùng Claude (đã có API key) làm nguồn tìm & tóm tắt tin thay Perplexity, thống nhất nhà cung cấp AI.
- **Business Value:** Tận dụng web search + tóm tắt chất lượng cao của Claude; giảm số nhà cung cấp phải quản lý key.
- **KPI:** giữ nguyên KPI tính năng gốc (đủ Top N ≥ 90% lần chạy; email thành công ≥ 95%).
- **Assumptions:**
  - `[A1]` Người dùng có `ANTHROPIC_API_KEY` **hoặc** `ANTHROPIC_AUTH_TOKEN`; thiếu cả hai ⇒ adapter Claude bị loại (như quy ước cũ với Perplexity).
  - `[A4]` OAuth token Claude Code **subscription** (`sk-ant-oat`) bị `429` khi gọi thẳng Messages API, NHƯNG **chạy được qua `claude` CLI headless** (đã verify thật: trả 3 tin, ~94s). Đây là lý do adapter dùng CLI thay SDK. Vẫn chấp nhận cả API key (`sk-ant-api...`) qua ENV `ANTHROPIC_API_KEY` + `--bare`.
  - `[A2]` Model qua env `CLAUDE_MODEL`, mặc định `claude-opus-4-8`.
  - `[A3]` Web search tool tính phí riêng theo số lần search; giới hạn `max_uses=5`/danh mục.

# Luồng Chính

1. Bước thu thập (06:00) với mỗi danh mục: Registry dựng `ClaudeAdapter` nếu có `ANTHROPIC_API_KEY`.
2. `ClaudeAdapter.search(query)` gọi Messages API kèm `web_search` tool; Claude tự search web, trả JSON list tin 24h + relevance.
3. Adapter parse JSON → `RawNewsItem[]` (đã sanitize) → vào pipeline dedup/rank/topN như cũ.

# Luồng Thay Thế

- **AT-1:** Chỉ có `ANTHROPIC_API_KEY` (thiếu Firecrawl/Apify) → thu thập bằng Claude, engagement=0, xếp theo relevance.
- **AT-2:** Có cả Claude + Firecrawl + Apify → 3 adapter chạy song song (fail-soft) như tính năng gốc.

# Luồng Ngoại Lệ

- **EX-1:** CLI trả nội dung không có JSON array (hoặc từ chối) → parse trả rỗng, pipeline tiếp tục với adapter khác.
- **EX-2:** CLI treo → timeout `CLAUDE_CLI_TIMEOUT_MS` + SIGKILL → adapter fail-soft.
- **EX-3:** JSON trả về không hợp lệ → quét ngoặc cân bằng thất bại → trả rỗng, không vỡ pipeline.
- **EX-4:** Thiếu cả `ANTHROPIC_API_KEY` lẫn `ANTHROPIC_AUTH_TOKEN` → không dựng ClaudeAdapter (không lỗi).
- **EX-5:** CLI exit≠0 (auth sai/hết hạn, hết credit, model sai, không có binary) → adapter throw → fail-soft + alert; thông điệp phân loại auth/quota.

# Logic Còn Thiếu

- `[LOW]` Chưa dùng biến thể web search dynamic-filtering (`_20260209`) do SDK hiện tại chỉ type `_20250305`; nâng cấp SDK sau nếu cần lọc tốt hơn.

# Business Rule Còn Thiếu

- Không phát hiện (giữ nguyên rule tính năng gốc).

# Validation Còn Thiếu

- `[LOW]` `CLAUDE_MODEL` nên là model hợp lệ; sai model → API 404 lúc chạy (log/alert như lỗi adapter).

# Phân Quyền Còn Thiếu

- Không phát hiện (không đổi bề mặt phân quyền).

# Trạng Thái Còn Thiếu

- Không phát hiện.

# Thông Báo Còn Thiếu

- Không phát hiện (alert adapter-fail đã có, áp dụng cho Claude).

# Audit Còn Thiếu

- `[LOW]` Nên đếm số lần web search (chi phí) theo ngày — kế thừa mục giám sát quota của tính năng gốc.

# Edge Cases

| Edge Case | Kỳ vọng xử lý | Mức rủi ro |
| --------- | ------------- | ---------- |
| CLI không có JSON/từ chối | Adapter trả rỗng, dùng nguồn khác | `[LOW]` |
| CLI treo | Timeout + SIGKILL → fail-soft | `[MEDIUM]` |
| CLAUDE_MODEL sai / auth hết hạn | CLI exit≠0 → adapter fail, alert | `[MEDIUM]` |
| Độ trễ CLI ~90s+/danh mục | Chạy trong worker (maxDuration 300s), song song các adapter | `[MEDIUM]` |
| Thiếu binary `claude` (vd Vercel serverless) | ENOENT → fail-soft; cần môi trường tự host | `[HIGH]` |

# Ảnh Hưởng Tính Năng Khác

- `[LOW]` Chỉ ảnh hưởng bước thu thập của `ban-tin-hang-ngay`. Không ảnh hưởng tính năng khác.

# Ảnh Hưởng Component Dùng Chung

| Component dùng chung | Tính năng bị ảnh hưởng | Regression Risk |
| -------------------- | ---------------------- | --------------- |
| Adapter Registry (env) | Bước thu thập | `[MEDIUM]` — đổi khóa `perplexityKey`→`anthropicKey`; thêm ưu tiên `anthropicAuthToken` |
| Config loader | Toàn hệ thống đọc `tools.*` | `[LOW]` — thêm đọc `ANTHROPIC_AUTH_TOKEN` |

# Rủi Ro Dữ Liệu

- Không phát hiện thay đổi (định dạng RawNewsItem giữ nguyên).

# Rủi Ro Bảo Mật

- `[HIGH]` `ANTHROPIC_API_KEY` là secret trả phí — chỉ để ENV, không log/không trả API (kế thừa kiểm soát secret tính năng gốc). Chi tiết ở /tn-bao-mat.

# Rủi Ro Đồng Thời

- Không phát hiện thay đổi.

# Rủi Ro Mở Rộng

- `[MEDIUM]` Chi phí Claude + web search theo số danh mục/lần search — cần giám sát quota (như tính năng gốc).

# Các Câu Hỏi Cần Làm Rõ

> Không còn câu hỏi chặn — thay đổi do người dùng chỉ định trực tiếp và đã hiện thực.
1. ✅ Nguồn AI: Perplexity → Claude API (web search tool).
2. ✅ Model: env `CLAUDE_MODEL`, mặc định `claude-opus-4-8`.
3. ✅ Thiếu `ANTHROPIC_API_KEY` ⇒ loại adapter (không lỗi).

# Đề Xuất Cải Tiến

- `[Trung bình]` Nâng SDK để dùng `web_search_20260209` (dynamic filtering) khi cần lọc kết quả tốt hơn.
- `[Thấp]` Thêm đếm số lần web search/ngày vào observability để kiểm soát chi phí.
