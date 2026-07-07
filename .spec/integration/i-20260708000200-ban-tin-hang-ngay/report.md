---
integration: i-20260708000200-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: report
status: draft
open_questions: 0
updated: 2026-07-08
---

# Tóm Tắt Lần Chạy
Delta run-now (force re-collect + đẩy tin cũ xuống + gửi email lại toàn bộ + email top-N). Ngày chạy: 2026-07-08. Runner: vitest **50/50 PASS**, `tsc --noEmit` sạch. Thêm 2 test DB (FT-RN-1/2).

| Chỉ số | Unit | Functional | E2E | Tổng |
|--------|------|------------|-----|------|
| Tổng case (delta) | 0 | 3 (FT-RN-1, FT-RN-2, run-now live) | 0 | 3 |
| PASS | 0 | 2 | 0 | 2 |
| FAIL | 0 | 0 | 0 | 0 |
| BLOCKED | 0 | 1 | 0 | 1 |

# Môi Trường & Runner
Next.js 15.5.20; MongoDB (mongodb-memory-server cho FT). `npx vitest run` (**50/50**), `npx tsc --noEmit` (sạch).

# Kết Quả Theo Test Case
| Case | Loại | Expected | Actual | Trạng thái |
|------|------|----------|--------|------------|
| FT-RN-1 | func(DB) | 3 cũ + shift+2 + 2 mới → 5 doc; rank 1,2=mới; 3..5=cũ | đúng | PASS |
| FT-RN-2 | func(DB) | sort rank limit 2 → 2 tin mới (rank 1,2) | đúng | PASS |
| run-now live | func | collect force → reset deliveries → gửi 1 email subscriber | cần bấm thật (gửi email ra ngoài) | BLOCKED |

# Defect Phát Hiện
Không phát hiện (0 FAIL).

# E2E & Locator
Không đổi UI → không có E2E mới, không back-prop locator.

# Coverage & Khoảng Hở
- DB-op cốt lõi (shift rank, send-limit) đã verify PASS.
- `[MEDIUM]` Route run-now end-to-end (gửi email thật) chưa chạy trong report — là hành động ra ngoài (1 subscriber active, mail đã cấu hình). Verify thủ công khi admin bấm "Chạy ngay".

# Case Chưa Chạy Được (BLOCKED)
- run-now live — gửi email thật tới subscriber; để admin chủ động bấm (rate-limit 10/60s).

# Kết Luận & Khuyến Nghị
- **GO cho delta** mức dev: logic force/shift/limit + regression PASS, tsc sạch, 0 defect.
- Xác nhận cuối: admin bấm "Chạy ngay" 2 lần trong cùng ngày để kiểm tin mới lên đầu + nhận 2 email (bản mới).
- `[MEDIUM]` Theo dõi thời lượng run-now (collect CLI ~90s + send) so với maxDuration 300s.
