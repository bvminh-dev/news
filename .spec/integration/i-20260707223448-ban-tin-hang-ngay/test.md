---
integration: i-20260707223448-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: test
status: approved
open_questions: 0
updated: 2026-07-07
---

# Phân Tích Requirement
Delta test cho việc thay Perplexity → ClaudeAdapter. Chỉ test phần đổi: Registry theo env (khóa `anthropicKey`), hành vi adapter (parse JSON, refusal, pause_turn), và regression cho pipeline (không đổi). Test case gốc của tính năng vẫn áp dụng (chỉ đổi tên nguồn "perplexity" → "claude").

# Test Conditions
- TCD-D1 Registry theo env: có/không `ANTHROPIC_API_KEY`.
- TCD-D6 Registry chọn credential: có `ANTHROPIC_AUTH_TOKEN` (ưu tiên) / chỉ key / cả hai (ưu tiên token) / không cả hai.
- TCD-D2 ClaudeAdapter parse JSON array (quét ngoặc cân bằng) hợp lệ / rỗng / sai định dạng / lẫn prose+markdown.
- TCD-D3 CLI exit≠0 (auth/quota/model sai/ENOENT) → throw, phân loại thông điệp; pipeline fail-soft.
- TCD-D4 CLI treo → timeout + SIGKILL → throw 'timeout'.
- TCD-D5 Sanitize title/summary từ Claude (chống XSS).
- TCD-D7 Định tuyến credential: `sk-ant-oat` → ENV `CLAUDE_CODE_OAUTH_TOKEN` (không `--bare`); `sk-ant-api` → ENV `ANTHROPIC_API_KEY` + `--bare`; xoá ENV auth kế thừa.

# Test Scenarios
- TS-D1 Chỉ có `ANTHROPIC_API_KEY` → adapter `claude` chạy, engagement=0, xếp theo relevance.
- TS-D2 Không có key nào → 0 adapter (collect failed + alert) — như tính năng gốc.

# Test Cases
| ID | Tiền điều kiện | Bước | Dữ liệu | Kết quả mong đợi | Kỹ thuật |
|----|----------------|------|---------|------------------|----------|
| TC-D1 | env đủ 3 key | buildActiveAdapters | anthropic+firecrawl+apify | 3 adapter | Decision Table |
| TC-D2 | chỉ ANTHROPIC_API_KEY | buildActiveAdapters | 1 key | 1 adapter, name="claude" | EP |
| TC-D3 | không key | buildActiveAdapters | rỗng | 0 adapter | EP |
| TC-D4 | — | parse JSON hợp lệ | `[{title,url,...}]` | RawNewsItem[] đúng | EP |
| TC-D5 | — | parse text không JSON | "xin lỗi..." | [] (không lỗi) | Negative |
| TC-D6 | — | title chứa `<script>` | nội dung độc | sanitize (không còn thẻ) | Error Guessing |
| TC-D7 | chỉ ANTHROPIC_AUTH_TOKEN | buildActiveAdapters | anthropicAuthToken="oat" | 1 adapter name="claude" | EP |
| TC-D8 | cả key lẫn token | buildActiveAdapters | key + token | 1 adapter claude (dựng bằng token — ưu tiên) | Decision Table |

# Boundary Values
| Trường | Min | Max | Kết quả |
|--------|-----|-----|---------|
| relevance | 0 | 1 | clamp về [0..1] |
| web search max_uses | — | 5 | giới hạn/danh mục |

# Equivalence Partitions
| Trường | Hợp lệ | Không hợp lệ |
|--------|--------|--------------|
| ANTHROPIC_API_KEY | có giá trị → adapter claude | rỗng → loại adapter |
| relevance trong JSON | số 0..1 | không phải số → undefined (mặc định 0.5 khi rank) |

# Decision Table
| Rule | anthropicKey? | firecrawlKey? | apifyToken? | Kết quả |
|------|---------------|---------------|-------------|---------|
| R1 | ✓ | ✓ | ✓ | 3 adapter |
| R2 | ✓ | ✗ | ✗ | 1 adapter (claude) |
| R3 | ✗ | ✗ | ✗ | 0 adapter |

# State Transition Matrix
| State (CLI spawn) | Event | Kế tiếp | Hợp lệ |
|-------------------|-------|---------|--------|
| spawned | stdout data | tích lũy buffer | ✔ |
| spawned | close code=0 | parse JSON array từ stdout | ✔ |
| spawned | close code≠0 | throw (phân loại auth/quota/exit) | ✔ |
| spawned | 'error' (ENOENT) | throw 'không chạy được claude CLI' | ✔ |
| spawned | quá `timeoutMs` | SIGKILL → throw 'timeout' | ✔ |

# Permission Matrix
Không đổi (adapter máy-máy, không chạm quyền người dùng).

# Negative Test Cases
- `[MEDIUM]` Claude trả text không phải JSON → parse trả [] (không throw).
- `[MEDIUM]` title/summary có HTML độc → sanitize.
- `[LOW]` CLAUDE_MODEL sai → API 404 → adapter fail-soft (dùng nguồn khác).

# Edge Cases
- `[LOW]` JSON array rỗng `[]` → 0 tin (danh mục thiếu tin, xử lý như gốc).
- `[LOW]` pause_turn liên tục → guard chặn ở 5.

# API Test Cases
- Không thêm endpoint. Guard cron/worker (đã có) vẫn phải chặn gọi trái phép (nay tốn phí web search).

# Security Test Cases
- `[CRITICAL]` Kích lỗi adapter → không lộ `ANTHROPIC_API_KEY` trong log/response.
- `[MEDIUM]` XSS: nội dung nguồn qua Claude → sanitize ở email/preview.

# Concurrency Test Cases
Không đổi.

# Integration Test Cases
- `[HIGH]` Claude API 5xx/429 → SDK retry → nếu vẫn lỗi, adapter fail-soft, pipeline ra kết quả (partial).
- `[MEDIUM]` refusal → trả [], dùng adapter khác.

# Regression Risks
| Hạng mục | Lý do | Risk |
|----------|-------|------|
| Adapter Registry | đổi khóa perplexityKey→anthropicKey | `[HIGH]` |
| Config loader | thêm anthropicKey/claudeModel | `[LOW]` |
| Pipeline dedup/rank | không đổi interface RawNewsItem | `[LOW]` |

# Missing Test Coverage
- `[LOW]` Chưa có Functional gọi Claude thật (cần API key + mạng); test hiện ở mức unit (registry) + parse logic. E2E collect với Claude cần môi trường có key.

# Dự Đoán Bug Tiềm Ẩn
- `[MEDIUM]` Quên đổi khóa env ở nơi khác (config.tools) → adapter không dựng. (Đã kiểm: config.tools.anthropicKey.)
- `[LOW]` Parse JSON bắt nhầm đoạn `[...]` trong summary → dùng indexOf('[')/lastIndexOf(']') có thể sai nếu text lạ; chấp nhận, item lỗi bị loại.

# Khuyến Nghị Kiểm Thử
- `[Ưu tiên 1]` Test Registry theo env (khóa mới) — regression cao.
- `[Ưu tiên 2]` Test parse JSON (hợp lệ/rỗng/sai) + sanitize.
- `[Ưu tiên 3]` Test tích hợp lỗi Claude (refusal/5xx) fail-soft.

# Phân Tầng Test Case (Test Pyramid)

# Tổng Quan Kim Tự Tháp
| Tầng | Số case | Ghi chú |
|------|---------|---------|
| Unit | 5 (3 gốc + UT-16d/e credential) | UT-16 buildActiveAdapters theo env (anthropicKey/anthropicAuthToken) |
| Functional | 1 mới (FT-CLI-LIVE) | Adapter live qua `claude` CLI: **PASS** (verify thủ công, token oat) |
| E2E | 0 mới | Không đổi luồng UI |

> Hình dạng: pyramid khỏe (đẩy về Unit). Test chính: UT-16 (registry theo env) đã cập nhật perplexity→claude và PASS.

# 1. Unit Test Cases
| ID | SUT | Input | Expected | Map |
|----|-----|-------|----------|-----|
| UT-16a | buildActiveAdapters | đủ 3 key | 3 adapter | TC-D1 |
| UT-16b | buildActiveAdapters | chỉ anthropicKey | 1 adapter name="claude" | TC-D2 |
| UT-16c | buildActiveAdapters | không key | 0 adapter | TC-D3 |
| UT-16d | buildActiveAdapters | chỉ anthropicAuthToken | 1 adapter name="claude" | TC-D7 |
| UT-16e | buildActiveAdapters | key + token | 1 adapter claude (ưu tiên token) | TC-D8 |

# 2. Functional Test Cases
| ID | Tính năng | Ghi chú | Map |
|----|-----------|---------|-----|
| FT-CLI-LIVE | `ClaudeAdapter.search()` live | **PASS** — spawn `claude` CLI với `ANTHROPIC_AUTH_TOKEN` (sk-ant-oat) trả 3 tin hợp lệ (title/url/relevance) ~94.5s; xác nhận token subscription chạy được qua CLI (hết 429) | TS-D1 |
| FT-08' | collect chỉ 1 nguồn (claude) qua pipeline DB | BLOCKED CI (cần credential+mạng+Mongo); adapter-live đã chứng minh ở FT-CLI-LIVE | TS-D1 |

# 3. E2E Test Cases
Không có case E2E mới (luồng UI không đổi).

# Ma Trận Truy Vết (Traceability)
| Yêu cầu (FRD delta) | Unit | Functional | E2E |
|---------------------|------|------------|-----|
| Registry theo env (anthropicKey) | UT-16a/b/c | — | — |
| Registry chọn credential (token ưu tiên key) | UT-16d/e | — | — |
| ClaudeAdapter tìm/tóm tắt/relevance | (parse logic) | FT-08' (BLOCKED) | — |
| Thiếu key ⇒ loại adapter | UT-16c | — | — |

# Khoảng Trống & Khuyến Nghị Đặt Tầng
- `[MEDIUM]` Functional gọi Claude thật (FT-08') BLOCKED do thiếu API key/mạng trong môi trường — chạy khi có `ANTHROPIC_API_KEY`.
- Parse/refusal/pause_turn: nên bổ sung unit test cô lập cho `ClaudeAdapter` (mock SDK) nếu cần độ phủ cao hơn.

# E2E Locators
Không thay đổi (không có UI mới). Kế thừa bảng E2E Locators của i-20260706231719.
