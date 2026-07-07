---
integration: i-20260708000200-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: frd
status: approved
open_questions: 0
updated: 2026-07-08
---

# Tóm Tắt Tính Năng

**Delta thay đổi hành vi "Chạy ngay" (Run-now) của admin:**
1. **Force re-collect + tin mới lên đầu:** khi admin bấm "Chạy ngay", hệ thống LUÔN thu thập lại (bỏ qua idempotency trong-ngày). Tin MỚI được re-rank lên `rank 1..N`; tin CŨ của cùng (danh mục, ngày) bị **đẩy xuống** (`rank += số tin mới`). **Giữ cả hai** trong DB (lịch sử trong ngày).
2. **Gửi email ngay:** sau khi collect có tin (`collected`/`partial`), run-now **reset trạng thái đã-gửi hôm nay** rồi **gửi lại email cho TẤT CẢ subscriber active** của danh mục — để mọi người nhận bộ tin mới.

> [i-20260708000200] bổ sung hành vi run-now; KHÔNG đổi cron 06:00/06:30 (vẫn idempotent như cũ).

**Phạm vi (in-scope):**
- `collectCategory(..., { force })`: `force=true` ⇒ bỏ qua no-op idempotency + đẩy rank tin cũ xuống trước khi upsert bộ tin mới.
- `/api/admin/run-now`: gọi collect `force:true`; nếu có tin ⇒ `resetDeliveries` + `sendCategory` (gửi đồng bộ trong request).
- `sendCategory`: giới hạn email về **top-N hiện hành** (`rank ≤ N`) ⇒ email = bộ tin mới trên đầu, không phình theo số lần chạy lại.

**Ngoài phạm vi:** cron theo lịch (không đổi), nguồn thu thập/adapter (không đổi), UI (không đổi bề mặt).

# Mục Tiêu Nghiệp Vụ

- **Business Goal:** Admin cần làm mới bản tin & phát hành ngay trong ngày mà không phải chờ lịch 06:30.
- **Business Value:** Chủ động cập nhật tin nóng + gửi lại cho người nhận tức thì; tin mới luôn ưu tiên hiển thị đầu.
- **KPI:** run-now hoàn tất < maxDuration (300s); email phát hành thành công cho subscriber active.
- **Assumptions:**
  - `[A1]` Force re-collect chỉ áp cho run-now (thủ công); cron hằng ngày giữ idempotent để tránh đốt quota.
  - `[A2]` "Gửi lại cho tất cả" là chủ ý (người đã nhận sẽ nhận thêm bản mới) — chấp nhận gửi trùng khi bấm nhiều lần.
  - `[A3]` DB giữ cả tin cũ lẫn mới trong ngày; email chỉ lấy top-N.

# Luồng Chính

1. Admin `POST /api/admin/run-now { categoryId }`.
2. `collectCategory(categoryId, today, now, { force:true })`: thu thập lại → dedup/window/rank → **đẩy rank tin cũ +N** → upsert N tin mới (rank 1..N).
3. Nếu status ∈ {collected, partial}: `resetDeliveries(categoryId, today)` → `sendCategory(categoryId, today)` (email top-N cho subscriber active).
4. Trả `{ date, result, send }`.

# Luồng Thay Thế

- **AT-1:** Chạy ngay lần đầu trong ngày (chưa có tin cũ) → chỉ chèn top-N mới (không có gì để đẩy), gửi email.
- **AT-2:** Chạy ngay lần thứ 2+ → tin cũ đẩy xuống, tin mới lên đầu, gửi lại toàn bộ.

# Luồng Ngoại Lệ

- **EX-1:** Collect `failed` (0 adapter / mọi nguồn lỗi) → KHÔNG reset deliveries, KHÔNG gửi (tránh xoá log rồi bỏ gửi). Trả `send=undefined`.
- **EX-2:** Collect OK nhưng 0 subscriber active → `sendCategory` trả `skipped` (no-subscriber).
- **EX-3:** Không có tin mới (mọi URL đã trong dedup-window) → 0 tin mới, không đẩy/chèn; email gửi lại bộ tin cũ (top-N hiện có).
- **EX-4:** Một số email lỗi → `send.status='partial'`, alert; delivery_logs ghi lỗi.

# Logic Còn Thiếu

- `[LOW]` Chạy ngay nhiều lần liên tiếp trong ngày làm tích lũy tin cũ (rank lớn dần) — chấp nhận theo lựa chọn "giữ cả hai"; có thể thêm retention/cắt cuối ngày sau.

# Business Rule Còn Thiếu

- Không phát hiện (giữ rule tính năng gốc).

# Validation Còn Thiếu

- `[LOW]` `categoryId` đã validate (zod pick). Không đổi.

# Phân Quyền Còn Thiếu

- Không phát hiện — run-now vẫn sau `requireAdmin` + checkOrigin + rate-limit (không đổi).

# Trạng Thái Còn Thiếu

- Không phát hiện.

# Thông Báo Còn Thiếu

- Không phát hiện (alert send-fail đã có).

# Audit Còn Thiếu

- `[LOW]` Nên phân biệt log run "manual/force" vs "cron" để truy vết (hiện chung digest_runs).

# Edge Cases

| Edge Case | Kỳ vọng xử lý | Mức rủi ro |
| --------- | ------------- | ---------- |
| Chạy ngay lần 2+ trong ngày | Tin cũ +N rank, tin mới rank 1..N, gửi lại tất cả | `[MEDIUM]` |
| Collect failed | Không reset/không gửi | `[MEDIUM]` |
| 0 tin mới | Không đẩy/chèn; email lại bộ cũ | `[LOW]` |
| Bấm run-now dồn dập | Gửi email trùng nhiều lần (rate-limit 10/60s giảm thiểu) | `[MEDIUM]` |

# Ảnh Hưởng Tính Năng Khác

- `[LOW]` Chỉ ảnh hưởng run-now + send của `ban-tin-hang-ngay`.

# Ảnh Hưởng Component Dùng Chung

| Component dùng chung | Tính năng bị ảnh hưởng | Regression Risk |
| -------------------- | ---------------------- | --------------- |
| `collectCategory` | Cron collect + run-now | `[MEDIUM]` — thêm nhánh `force`; đường không-force phải giữ nguyên |
| `sendCategory` | Cron send + run-now | `[MEDIUM]` — thêm `.limit(topN)`; ảnh hưởng cả cron 06:30 (an toàn: bình thường chỉ có N tin) |

# Rủi Ro Dữ Liệu

- `[MEDIUM]` Tích lũy tin cũ trong ngày khi chạy nhiều lần → nhiều doc/ngày; rank không còn liên tục 1..N cho toàn bộ (nhưng top-N vẫn đúng).

# Rủi Ro Đồng Thời

- `[MEDIUM]` Hai run-now song song cùng danh mục/ngày: `$inc rank` + upsert có thể chồng chéo (rank lệch). Rate-limit + thao tác thủ công đơn admin giảm thiểu.

# Rủi Ro Mở Rộng

- `[LOW]` Không đổi (vẫn 1 danh mục/lần chạy ngay).

# Các Câu Hỏi Cần Làm Rõ

> Không còn câu hỏi chặn — hành vi do người dùng chốt trực tiếp.
1. ✅ Data cũ: giữ cả hai, đẩy cũ xuống +N (người dùng chọn).
2. ✅ Gửi email: gửi lại cho tất cả (reset deliveries hôm nay).
3. ✅ Email giới hạn top-N (bộ tin mới trên đầu).

# Đề Xuất Cải Tiến

- `[Trung bình]` Cron gửi nền (background) để run-now trả nhanh, tránh giữ request ~90s+ (collect CLI) + send.
- `[Thấp]` Cắt/gộp tin cũ cuối ngày để DB không tích lũy khi chạy ngay nhiều lần.
