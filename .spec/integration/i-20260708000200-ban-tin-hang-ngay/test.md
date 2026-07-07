---
integration: i-20260708000200-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: test
status: approved
open_questions: 0
updated: 2026-07-08
---

# Phân Tích Requirement
Delta test cho hành vi run-now: (1) force re-collect đẩy tin cũ xuống, tin mới lên đầu, giữ cả hai; (2) gửi email lại toàn bộ; (3) email giới hạn top-N. Đường cron không đổi (regression).

# Test Conditions
- TCD-1 `force=true` → bỏ qua idempotency no-op (luôn re-collect).
- TCD-2 Shift rank: tin cũ `rank += số tin mới`; tin mới `rank 1..N`; giữ cả hai.
- TCD-3 `force=false` (cron) → giữ idempotency (no-op nếu đã collected).
- TCD-4 run-now: collect fail → KHÔNG reset deliveries, KHÔNG gửi.
- TCD-5 run-now: collect OK → resetDeliveries + sendCategory.
- TCD-6 send giới hạn `.limit(topN)` → chỉ top-N (bộ tin mới trên đầu).

# Test Scenarios
- TS-1 Chạy ngay lần 2 trong ngày: 3 tin cũ + 2 tin mới → DB 5 doc, rank [1,2]=mới, [3,4,5]=cũ.
- TS-2 Chạy ngay khi collect failed → send bỏ qua, delivery_logs không bị xoá oan (do chưa tới nhánh reset).

# Test Cases
| ID | Tiền điều kiện | Bước | Dữ liệu | Kết quả mong đợi | Kỹ thuật |
|----|----------------|------|---------|------------------|----------|
| TC-1 | 3 tin cũ rank 1..3 | shift +2, chèn 2 tin mới rank 1..2 | new.com/1..2 | 5 doc; rank 1,2=mới; 3..5=cũ | State Transition |
| TC-2 | 5 tin (2 mới,3 cũ) | query sort rank limit N=2 | — | 2 tin mới (rank 1,2) | Boundary |
| TC-3 | collect status='failed' | route bỏ nhánh send | — | send=undefined; deliveries giữ nguyên | Decision Table |
| TC-4 | đã collected (cron) | collectCategory force=false | — | no-op idempotent (không đẩy/chèn) | Decision Table |

# Boundary Values
| Trường | Min | Max | Kết quả |
|--------|-----|-----|---------|
| số tin mới N | 0 | topN | N=0 → không đẩy/chèn |
| send limit | — | topN | lấy đúng ≤ topN |

# Equivalence Partitions
| Trường | Hợp lệ | Không hợp lệ |
|--------|--------|--------------|
| force | true (run-now) / false (cron) | — |
| collect status trước send | collected/partial → gửi | failed/skipped → không gửi |

# Decision Table
| Rule | force | collect status | Hành vi |
|------|-------|----------------|---------|
| R1 | true | collected/partial | đẩy cũ + chèn mới → reset deliveries → send |
| R2 | true | failed | re-collect nhưng KHÔNG reset/không gửi |
| R3 | false | đã collected | no-op idempotent |

# State Transition Matrix
| State | Event | Kế tiếp |
|-------|-------|---------|
| có tin cũ (rank 1..k) | run-now force, N tin mới | cũ→rank+N; mới→rank 1..N |
| chưa có tin | run-now force, N tin mới | mới→rank 1..N |

# Permission Matrix
Không đổi (admin-only).

# Negative Test Cases
- `[MEDIUM]` Collect failed → reset deliveries KHÔNG chạy (không xoá log rồi bỏ gửi).
- `[LOW]` N=0 (không tin mới) → không `$inc`, không chèn.

# Edge Cases
- `[MEDIUM]` Chạy ngay nhiều lần → tích lũy tin cũ, rank tăng dần; top-N (send) vẫn đúng.
- `[LOW]` 0 subscriber → send 'skipped'.

# API Test Cases
- `[HIGH]` `POST /api/admin/run-now` (admin) → 200 `{date,result,send}`; thiếu auth → 401/redirect; sai origin → 403; quá 10 lần/60s → 429.

# Security Test Cases
- `[MEDIUM]` Spam run-now → rate-limit chặn (429) trước khi đốt quota/gửi.

# Concurrency Test Cases
- `[LOW]` 2 run-now song song → rank có thể lệch (chấp nhận GĐ1).

# Integration Test Cases
- `[HIGH]` collect force → send end-to-end (cần credential+mạng+Mongo+SMTP) — BLOCKED CI; verify thủ công.

# Regression Risks
| Hạng mục | Lý do | Risk |
|----------|-------|------|
| collectCategory (cron) | thêm nhánh force | `[MEDIUM]` — đường force=false phải không đổi |
| sendCategory (cron 06:30) | thêm `.limit(topN)` | `[MEDIUM]` — bình thường chỉ N tin ⇒ an toàn |

# Missing Test Coverage
- `[MEDIUM]` Chưa test full route run-now (mock collect+send); hiện phủ ở mức thao tác DB (shift/limit) + regression suite.

# Dự Đoán Bug Tiềm Ẩn
- `[MEDIUM]` Quên guard collect-failed → xoá deliveries rồi không gửi. (Đã guard: chỉ reset+send khi collected/partial.)
- `[LOW]` `.limit(topN)` áp nhầm cả cron → thực ra an toàn vì cron chỉ ghi N tin.

# Phân Tầng Test Case (Test Pyramid)

# Tổng Quan Kim Tự Tháp
| Tầng | Số case | Ghi chú |
|------|---------|---------|
| Unit | 0 mới | logic nằm ở DB op + orchestration |
| Functional (DB) | 2 mới | shift rank + send-limit (mongodb-memory-server) |
| E2E | 0 mới | không đổi UI |

# 1. Unit Test Cases
(kế thừa; không thêm)

# 2. Functional Test Cases
| ID | SUT | Input | Expected | Map |
|----|-----|-------|----------|-----|
| FT-RN-1 | shift rank + chèn mới | 3 cũ + `$inc 2` + 2 mới | 5 doc; rank 1,2=mới; 3..5=cũ | TC-1 |
| FT-RN-2 | send limit top-N | 5 doc, sort rank limit 2 | 2 tin mới (rank 1,2) | TC-2 |

# 3. E2E Test Cases
Không có (UI không đổi).

# Ma Trận Truy Vết (Traceability)
| Yêu cầu (FRD delta) | Unit | Functional | E2E |
|---------------------|------|------------|-----|
| Force đẩy cũ xuống, mới lên đầu | — | FT-RN-1 | — |
| Email top-N (bộ mới) | — | FT-RN-2 | — |
| Run-now gửi email/không gửi khi fail | — | (route, verify thủ công) | — |

# Khoảng Trống & Khuyến Nghị Đặt Tầng
- `[MEDIUM]` Route run-now (collect→reset→send) nên có test tích hợp mock; hiện verify thủ công + phủ DB-op.

# E2E Locators
Không thay đổi (không có UI mới).
