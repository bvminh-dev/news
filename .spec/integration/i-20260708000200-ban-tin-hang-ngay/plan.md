---
integration: i-20260708000200-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: plan
status: approved
open_questions: 0
updated: 2026-07-08
---

# Tổng Quan & Phạm Vi
Hiện thực delta run-now (force + email). Gói gọn trong service layer + 1 route. **Code đã hiện thực trước** theo yêu cầu trực tiếp; plan ghi nhận task + tiêu chí Done để đối chiếu.

# Danh Sách Task
| Task | Mô tả | Phụ thuộc | Tham chiếu | Tiêu chí Done |
|------|-------|-----------|------------|----------------|
| R1 | `collectCategory(..., {force})`: bỏ qua idempotency khi force | — | tech ADR-01 | typecheck sạch |
| R2 | Shift rank: `force && ranked.length>0` → `updateMany $inc rank += ranked.length` trước upsert | R1 | frd luồng chính; test FT-RN-1 | FT-RN-1 PASS |
| R3 | `sendCategory` giới hạn `.limit(topN)` | — | tech ADR-03; test FT-RN-2 | FT-RN-2 PASS |
| R4 | `resetDeliveries(categoryId,date)` (deleteMany delivery_logs) | — | tech ADR-02 | export + dùng ở route |
| R5 | `/api/admin/run-now`: collect force → nếu collected/partial → reset + send; trả `{date,result,send}` | R1..R4 | frd luồng; security §API | route đúng; typecheck sạch |
| R6 | Test DB (FT-RN-1/2) + regression suite | R2,R3 | test | 50/50 PASS |
| R7 | Verify: tsc + vitest | R1..R6 | test | tsc sạch · 50/50 PASS |

# Đồ Thị Phụ Thuộc
```
R1 → R2 ┐
R3      ├→ R5 → R6 → R7
R4 ─────┘
```
Đường găng: `R1 → R2 → R5 → R6 → R7`.

# Tiêu Chí Done Tổng
- [x] Run-now force re-collect; cron giữ idempotent (force mặc định false).
- [x] Tin cũ đẩy xuống +N, tin mới rank 1..N, giữ cả hai.
- [x] Run-now reset deliveries + gửi lại toàn bộ; KHÔNG gửi khi collect failed.
- [x] Email giới hạn top-N.
- [x] tsc sạch; vitest 50/50 (thêm FT-RN-1/2).

# Rủi Ro & Giả Định
- `[MEDIUM]` Regression đường cron (force=false, .limit) — mitigate bằng suite 50/50.
- `[MEDIUM]` Run-now đồng bộ dài (collect CLI ~90s + send) — trong maxDuration 300s.
- Giả định: giữ cả hai tin cũ/mới + gửi lại tất cả (người dùng chốt).

# Ghi Chú Cho /tn-code
Tất cả doc {frd,tech,security,test,plan} approved, open_questions=0 ⇒ đủ gate. Code đã hiện thực + verify; /tn-code đối chiếu.
