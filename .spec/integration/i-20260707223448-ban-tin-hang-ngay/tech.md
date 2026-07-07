---
integration: i-20260707223448-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: tech
status: approved
open_questions: 0
updated: 2026-07-07
---

# Tóm Tắt Kiến Trúc

Delta thiết kế: thay `PerplexityAdapter` bằng `ClaudeAdapter` trong port `NewsSourceAdapter` (ACL không đổi). Adapter **spawn `claude` CLI headless (`claude -p`)** và bơm credential qua ENV để CLI tự web-search + tóm tắt + chấm relevance, trả JSON array. Kiến trúc tổng thể (Hexagonal, Registry-theo-env, pipeline) **không đổi** — chỉ thay 1 adapter và 1 khóa env.

> [i-20260707223448] thay thế ADR-05 (nguồn AI relevance): Perplexity → Claude.
> [i-20260707223448-b] **thay thế phương thức gọi** (supersede ADR-01): SDK `messages.create` + web_search tool → **spawn `claude` CLI headless**. Lý do: token subscription OAuth (`sk-ant-oat`) bị `429 rate_limit_error` khi gọi thẳng Messages API; CLI headless (ENV `CLAUDE_CODE_OAUTH_TOKEN`) chạy được. **Ràng buộc triển khai:** cần binary `claude` + spawn subprocess ⇒ KHÔNG chạy trên Vercel serverless; dùng môi trường tự host/long-running.

# Domain Model
Không đổi. `ClaudeAdapter` vẫn map dữ liệu ngoài → `RawNewsItem` (title/url/publishedAt/summary/rawEngagement/relevance).

# Ubiquitous Language
| Khái niệm | Tên hiện tại | Vấn đề | Khuyến nghị |
|-----------|--------------|--------|-------------|
| Nguồn AI tìm tin | `ClaudeAdapter` (name="claude") | trước là "perplexity" | Dùng `claude`; relevance do Claude chấm |

# Bounded Context
Không đổi (adapter nằm trong News Aggregation CTX, ACL tại adapter).

# Aggregate Design
Không đổi.

# Domain Events
Không đổi.

# Event Storming
Không đổi.

# Data Ownership Matrix
| Data Item | Owner | Master System | Vấn đề |
|-----------|-------|---------------|--------|
| ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / CLAUDE_MODEL | Config CTX | ENV | `[CRITICAL]` secret chỉ ở ENV (thay PERPLEXITY_API_KEY); credential = key HOẶC token, ưu tiên token |

# Source Of Truth Matrix
| Data Item | Nguồn | Source of Truth | Quy tắc |
|-----------|-------|-----------------|---------|
| Nội dung + relevance tin | Claude (web search) | Nguồn gốc URL; DB là snapshot | như cũ |

# Historical Data Analysis
Không đổi (NewsItem snapshot bất biến; thêm `algoVersion` giữ nguyên).

# Data Lifecycle Analysis
Không đổi.

# Architecture Pattern Review
- Giữ Ports & Adapters + Registry. `ClaudeAdapter` triển khai `NewsSourceAdapter.search()`.
- `[MEDIUM]` Tránh over-engineering: không thêm lớp trừu tượng "AI provider" riêng — Registry theo env là đủ.

# API Review
- Không thêm endpoint. Adapter **spawn** `claude -p --model <model> --permission-mode plan [--bare nếu API key]`; prompt qua stdin; đọc JSON array từ stdout. CLI tự dùng WebSearch tool nội bộ.

# Integration Review
| Hệ ngoài | Retry | Timeout | Fallback | Circuit Breaker | Rủi ro |
|----------|-------|---------|----------|-----------------|--------|
| Claude qua `claude` CLI (spawn subprocess) | không (1 lần/chạy) | `CLAUDE_CLI_TIMEOUT_MS` (mặc định 180s) + SIGKILL | bỏ qua nguồn này (fail-soft), dùng adapter khác | đếm lỗi/ngày (kế thừa) | `[HIGH]` độ trễ ~90s+/danh mục; cần binary CLI (không chạy Vercel serverless) |

# Integration Failure Analysis
| Kịch bản | Còn chạy? | Mất dữ liệu? | Xử lý |
|----------|-----------|--------------|-------|
| CLI không tìm thấy binary (ENOENT) | Có | Không | child 'error' → adapter throw → fail-soft, dùng nguồn khác |
| CLI exit≠0 (auth/quota/model sai) | Có | Không | gộp stdout+stderr, phân loại auth/quota → throw → fail-soft, alert |
| CLI treo | Có | Không | timeout `CLAUDE_CLI_TIMEOUT_MS` + SIGKILL → fail-soft |
| Output không phải JSON array | Có | Không | quét ngoặc cân bằng thất bại → trả [] (không vỡ pipeline) |

# Multi Tenant Review
Không áp dụng (không đổi).

# Authentication Review
Claude credential là secret máy-máy, tách biệt session admin. Adapter **bơm credential vào ENV của tiến trình `claude` con** (tự nhận diện theo tiền tố):
- `sk-ant-api...` (Console API key) → ENV `ANTHROPIC_API_KEY` + cờ `--bare` (CLI bỏ qua OAuth/keychain máy host).
- `sk-ant-oat...` (OAuth token Claude Code) → ENV `CLAUDE_CODE_OAUTH_TOKEN`.
- **Cô lập:** mỗi lần chạy xoá 3 ENV auth kế thừa (`ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`/`CLAUDE_CODE_OAUTH_TOKEN`) rồi set ĐÚNG 1 loại; `CLAUDE_CONFIG_DIR` tạm riêng (mkdtemp) ⇒ CLI không "mượn" tài khoản máy host; dọn trong `finally`.

`[HIGH]` OAuth token ngắn hạn/hết hạn, **không tự refresh** — cần cập nhật thủ công khi hết hạn (CLI trả lỗi auth → fail-soft). Token subscription **chạy được qua CLI** (khác Messages API bị 429 — xem ADR-06).

# Authorization Review
Không đổi.

# Permission Scope Matrix
Không đổi.

# Security Threat Model
| STRIDE | Threat | Biện pháp | Mức |
|--------|--------|-----------|-----|
| Info Disclosure | Lộ ANTHROPIC_API_KEY qua log | chỉ ENV, không log | `[CRITICAL]` |
| DoS/Cost | Web search gọi nhiều lần | max_uses=5/danh mục + giám sát | `[MEDIUM]` |
| SSRF | (Claude web search do Anthropic thực thi server-side) | không tăng bề mặt SSRF phía ta | `[LOW]` |

# Performance Risks
- `[MEDIUM]` Claude + web search có độ trễ; chạy trong worker riêng (đã có) — không chặn.

# Scalability Risks
- `[MEDIUM]` Chi phí Claude + web search theo số danh mục — giám sát quota.

# Observability Gaps
- `[LOW]` Nên log số lần web search/danh mục (chi phí). Log adapter-fail đã có.

# Technical Debt Risks
- `[MEDIUM]` Phụ thuộc binary ngoài (`claude` CLI) + spawn subprocess: khó chạy serverless, cần cài/nâng CLI ở môi trường host; version CLI đổi cờ có thể vỡ (đã ghim cờ đã verify: `-p`,`--model`,`--permission-mode plan`,`--bare`).
- `[LOW]` `@anthropic-ai/sdk` không còn dùng ở nguồn (adapter chuyển sang CLI) — có thể gỡ khỏi dependencies sau.

# ADR Recommendations
| ID | Decision | Reason | Alternative | Trade-Off | Consequence |
|----|----------|--------|-------------|-----------|-------------|
| ADR-20260707223448-01 | Nguồn AI = Claude Messages API + web_search tool (thay Perplexity, thay ADR-05) | Người dùng đã có Claude key; hợp nhất provider | Giữ Perplexity / thêm cả hai | Web search tính phí riêng; phụ thuộc Anthropic | Adapter `claude` trong Registry; relevance do Claude chấm |
| ADR-20260707223448-02 | Model qua env `CLAUDE_MODEL` (mặc định claude-opus-4-8) | Không hardcode; dễ đổi tier | Hardcode model | Cấu hình thêm 1 biến | Linh hoạt chọn model |
| ADR-20260707223448-03 | Dùng `web_search_20250305` (SDK type sẵn) | SDK 0.70.1 chưa type `_20260209` | Nâng SDK ngay | Không có dynamic filtering | Type-safe, chạy trên opus-4-8 |
| ADR-20260707223448-04 | Hỗ trợ 2 credential: `ANTHROPIC_API_KEY` (x-api-key) và `ANTHROPIC_AUTH_TOKEN` (Bearer OAuth); ưu tiên token nếu có cả hai | Người dùng muốn dùng OAuth token Claude Code; linh hoạt nguồn xác thực | Chỉ API key | Thêm 1 biến env + nhánh nhận diện tiền tố trong adapter | Registry chọn `anthropicAuthToken \|\| anthropicKey`; adapter tự route header |
| ADR-20260707223448-05 | ~~Khuyến cáo dùng API key thật; token subscription chỉ fallback~~ (thay bằng ADR-06) | Verify: OAuth subscription bị `429` trên Messages API | — | — | Superseded bởi ADR-06 |
| ADR-20260707223448-06 | **Đổi cơ chế gọi Claude: spawn `claude` CLI headless (`claude -p`)** thay SDK Messages API; credential bơm qua ENV (`CLAUDE_CODE_OAUTH_TOKEN` cho oat, `ANTHROPIC_API_KEY`+`--bare` cho api) | Token subscription (sk-ant-oat) chạy được qua CLI nhưng bị 429 khi gọi thẳng Messages API; người dùng muốn dùng token subscription | Giữ SDK (buộc phải có API key trả phí) | Cần binary `claude` + spawn subprocess ⇒ **không chạy Vercel serverless**; độ trễ ~90s+/danh mục | Verify thật: token oat trả 3 tin, 94.5s. Dùng môi trường tự host/long-running |

# Quality Attribute Assessment
| Thuộc tính | Đánh giá | Mức |
|-----------|----------|-----|
| Security | Secret ENV | `[CRITICAL]` |
| Reliability | fail-soft + retry | `[HIGH]` |
| Maintainability | 1 adapter thay thế, interface không đổi | `[LOW]` |
| Cost/Scalability | web search phí riêng | `[MEDIUM]` |

# Open Questions
> Không còn Open Question chặn.
1. ✅ Model qua env, mặc định claude-opus-4-8.
2. 🟡 Nâng SDK để dùng web_search_20260209 — để sau, không chặn.

# Architecture Recommendations
- `[Ưu tiên 1]` Giữ interface `NewsSourceAdapter` ổn định — thay adapter không đụng pipeline.
- `[Ưu tiên 2]` Secret ANTHROPIC_API_KEY chỉ ENV, không log; giám sát số lần web search (chi phí).
- `[Ưu tiên 3]` Cân nhắc nâng SDK cho dynamic-filtering web search khi cần.
