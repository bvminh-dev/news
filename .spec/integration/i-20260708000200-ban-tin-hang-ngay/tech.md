---
integration: i-20260708000200-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: tech
status: approved
open_questions: 0
updated: 2026-07-08
---

# Tóm Tắt Kiến Trúc

Delta thiết kế trong service layer (không đổi port/adapter/domain): thêm chế độ `force` cho `collectCategory` và ghép collect→send đồng bộ trong endpoint run-now. Kiến trúc Hexagonal + pipeline giữ nguyên.

> [i-20260708000200] bổ sung ADR-01 (run-now = force + email); không đụng ADR nguồn AI (i-20260707223448) hay lịch cron.

# Domain Model
Không đổi (`NewsItem`, `DigestRun`, `DeliveryLog`). `rank` giờ có thể > N cho tin cũ bị đẩy xuống trong cùng ngày (top-N vẫn là rank 1..N).

# Ubiquitous Language
| Khái niệm | Tên | Ý nghĩa |
|-----------|-----|---------|
| Chạy ngay (force) | run-now / `force:true` | Thu thập lại thủ công, bỏ qua idempotency, tin mới lên đầu |
| Đẩy xuống | rank shift | `$inc rank += số tin mới` cho tin cũ cùng (danh mục, ngày) |

# Bounded Context
Không đổi (News Aggregation + Digest Delivery CTX).

# Aggregate Design
Không đổi.

# Domain Events / Event Storming
Không đổi.

# Data Ownership Matrix
Không đổi. `news_items.rank` do collect ghi; run-now cập nhật rank tin cũ + chèn tin mới.

# Source Of Truth Matrix
Không đổi.

# Historical Data Analysis
Tin cũ trong ngày KHÔNG bị xoá — giữ làm lịch sử, chỉ đổi `rank`. Số doc/ngày tăng theo số lần chạy ngay.

# Data Lifecycle Analysis
`[LOW]` Chưa có bước gom/cắt tin cũ tích lũy trong ngày; retention theo ngày (tính năng gốc) vẫn áp dụng.

# Architecture Pattern Review
- Giữ service functions thuần. `force` là tham số tùy chọn (mặc định false) ⇒ cron gọi không đổi hành vi.
- Ghép collect→send ở tầng route (orchestration), không nhét send vào collect (giữ tách bước).

# API Review
- `POST /api/admin/run-now`: body `{ categoryId }`. Nay trả `{ date, result, send? }`. `send` chỉ có khi collect ∈ {collected, partial}.
- Không thêm endpoint mới.

# Integration Review
| Hệ ngoài | Retry | Timeout | Fallback | Rủi ro |
|----------|-------|---------|----------|--------|
| Claude CLI (collect) | 1 lần | CLAUDE_CLI_TIMEOUT_MS | fail-soft | `[MEDIUM]` run-now giữ request lâu (~90s collect + send) |
| SMTP (send) | retry 1 lần/người nhận | SDK mail | ghi delivery_logs 'failed' + alert | `[MEDIUM]` |

# Integration Failure Analysis
| Kịch bản | Còn chạy? | Mất dữ liệu? | Xử lý |
|----------|-----------|--------------|-------|
| Collect failed | Có | Không | không reset deliveries, không gửi (EX-1) |
| Send lỗi một phần | Có | Không | delivery_logs 'failed', status partial, alert |
| Request timeout (maxDuration) | — | Không | collect/send idempotent phần đã ghi; bấm lại được |

# Multi Tenant Review
Không áp dụng.

# Authentication Review
Không đổi — run-now vẫn sau `requireAdmin` (session admin) + `checkOrigin` (CSRF) + rate-limit.

# Authorization Review
Không đổi.

# Permission Scope Matrix
Không đổi.

# Security Threat Model
| STRIDE | Threat | Biện pháp | Mức |
|--------|--------|-----------|-----|
| DoS/Cost | Bấm run-now dồn dập đốt quota Claude + spam email | Rate-limit 10/60s + admin-only + CSRF | `[MEDIUM]` |
| Tampering | Đua đồng thời làm rank lệch | Thao tác đơn admin + rate-limit (chấp nhận) | `[LOW]` |

# Performance Risks
- `[MEDIUM]` Run-now đồng bộ = collect (~90s CLI) + send (n subscriber). Trong ngân sách maxDuration 300s với quy mô hiện tại; nhiều subscriber/nhiều lần chạy cần cân nhắc nền.

# Scalability Risks
- `[LOW]` Tích lũy news_items/ngày khi chạy nhiều lần.

# Observability Gaps
- `[LOW]` Chưa gắn cờ phân biệt run manual(force) vs cron trong digest_runs.

# Technical Debt Risks
- `[LOW]` Đua đồng thời trên `$inc rank` chưa có khóa; chấp nhận cho quy mô 1 admin.

# ADR Recommendations
| ID | Decision | Reason | Alternative | Trade-Off | Consequence |
|----|----------|--------|-------------|-----------|-------------|
| ADR-20260708000200-01 | Run-now = FORCE re-collect (đẩy tin cũ +N rank, tin mới rank 1..N, giữ cả hai) | Người dùng muốn làm mới trong ngày, tin mới ưu tiên, giữ lịch sử | Thay thế hẳn (xoá cũ) / no-op idempotent | Tích lũy doc/ngày; rank không liên tục toàn cục | `collectCategory({force})`; cron giữ idempotent |
| ADR-20260708000200-02 | Run-now gửi email đồng bộ + reset deliveries hôm nay | "Gửi ngay cho tất cả" theo yêu cầu | Chỉ collect, gửi theo cron 06:30 | Request lâu hơn; có thể gửi trùng khi bấm nhiều | route ghép collect→resetDeliveries→send |
| ADR-20260708000200-03 | `sendCategory` giới hạn top-N (`.limit(N)`) | Email = bộ tin mới trên đầu; không phình khi giữ cả tin cũ | Gửi mọi tin của ngày | Cron 06:30 cũng bị giới hạn (an toàn: thường chỉ N tin) | email ổn định N tin |

# Quality Attribute Assessment
| Thuộc tính | Đánh giá | Mức |
|-----------|----------|-----|
| Reliability | fail-soft collect/send; không gửi khi collect fail | `[HIGH]` |
| Maintainability | tham số `force` tùy chọn, không phá đường cron | `[MEDIUM]` |
| Performance | run-now đồng bộ dài | `[MEDIUM]` |

# Open Questions
> Không còn Open Question chặn.

# Architecture Recommendations
- `[Ưu tiên 1]` Giữ `force` mặc định false — cron không đổi hành vi.
- `[Ưu tiên 2]` Cân nhắc gửi email nền (queue) để run-now trả nhanh.
- `[Ưu tiên 3]` Thêm cờ nguồn-run (manual/cron) vào digest_runs cho observability.
