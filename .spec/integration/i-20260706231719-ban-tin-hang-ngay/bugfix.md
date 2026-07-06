---
integration: i-20260706231719-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: report
status: draft
open_questions: 0
updated: 2026-07-07
---

# Bugfix — i-20260706231719-ban-tin-hang-ngay (/tn-review)

Phát hiện qua review-code (Principal Engineer). Các bug DB-runtime chưa lộ ở bước /tn-bao-cao vì Functional DB-backed đang BLOCKED (không có MongoDB). Ghi tài liệu trước, sửa sau.

---

## BUG-1 `[CRITICAL]` Upsert news_items xung đột `createdAt` → collect luôn ném lỗi
- **Vị trí:** `src/services/collect.ts:139-143`.
- **Triệu chứng:** Mỗi lần thu thập, `updateOne(..., { $set: { ...doc, ... }, $setOnInsert: { createdAt: now } }, { upsert: true })` sẽ bị MongoDB từ chối: *"Updating the path 'createdAt' would create a conflict at 'createdAt'"* vì `createdAt` có trong CẢ `$set` (do spread `...doc`) lẫn `$setOnInsert`. Kết quả: **không tin nào được lưu**; collect thất bại runtime.
- **Nguyên nhân gốc (root cause):** `doc: NewsItemDoc` đã chứa `createdAt`; khi spread vào `$set` lại đặt thêm `$setOnInsert.createdAt` cùng field → vi phạm ràng buộc "một field không được xuất hiện ở nhiều operator update".
- **Cách sửa:** Loại `createdAt` khỏi `$set` (tách khỏi doc), chỉ giữ ở `$setOnInsert`; đồng thời (xem BUG-2) đưa `date` vào khóa lọc upsert.
- **Phòng ngừa tái diễn:** Khi upsert, KHÔNG spread cả object chứa field cũng nằm trong `$setOnInsert`. Bắt buộc có Functional test DB-backed (mongodb-memory-server) cho đường ghi collect trước khi coi là done.

## BUG-2 `[HIGH]` Unique index `(categoryId, normalizedUrl)` thiếu `date` → hỏng dữ liệu lịch sử
- **Vị trí:** `src/models/index.ts:134` + upsert `src/services/collect.ts:140`.
- **Triệu chứng:** Tin có URL X thu thập ngày D1 (lưu `date=D1`). Sau khi qua `DEDUP_WINDOW_DAYS` (mặc định 14) nhưng còn trong `NEWS_RETENTION_DAYS` (mặc định 30) — tức ngày D15..D30 — X được coi là "fresh" (dedup không lọc) và collect ngày D15 upsert theo `(categoryId, normalizedUrl)` → **ghi đè doc D1**, đổi `date` từ D1 thành D15, rank/score mới. Bản ghi lịch sử D1 biến mất; `createdAt` (giữ qua $setOnInsert) lệch với `date` → TTL xóa sớm/không nhất quán.
- **Nguyên nhân gốc:** Khóa duy nhất theo `(categoryId, normalizedUrl)` mâu thuẫn với yêu cầu "lưu lịch sử theo ngày + cho phép tái xuất sau dedup window". Khóa đúng phải bao gồm `date`.
- **Cách sửa:** Đổi unique index thành `(categoryId, date, normalizedUrl)`; upsert lọc theo `{ categoryId, date, normalizedUrl }`. Giữ idempotent trong-ngày (rerun cùng ngày → cùng khóa), tách bản ghi giữa các ngày (không đè lịch sử). Dedup xuyên ngày vẫn do logic `seen` đảm nhiệm (không phụ thuộc unique index).
- **Phòng ngừa:** Khi thiết kế khóa duy nhất cho dữ liệu có chiều thời gian (temporal), luôn cân nhắc đưa `date`/period vào khóa; đối chiếu với `retention ≥ dedupWindow` để không tạo vùng va chạm.

## BUG-3 `[HIGH]` Login thiếu rate-limit/lockout (Broken Auth mềm)
- **Vị trí:** `src/auth/auth.ts` (Credentials `authorize`).
- **Triệu chứng:** Không giới hạn số lần thử đăng nhập → brute-force/credential-stuffing không bị cản. security.md `[HIGH]` yêu cầu rate-limit + lockout; TC-03 mong đợi khóa tạm sau 5 lần sai.
- **Nguyên nhân gốc:** Bỏ sót lớp chống dò khi hiện thực auth (chỉ dựa bcrypt + generic error).
- **Cách sửa:** Trong `authorize`, dùng `rateLimit` theo IP (từ `request.headers['x-forwarded-for']`) — vượt ngưỡng (vd 5 lần/5 phút) → trả null (từ chối) và log cảnh báo. (Ghi chú: in-memory là phòng thủ cơ bản; production nhiều instance nên dùng Upstash Ratelimit.)
- **Phòng ngừa:** Checklist bảo mật go-live phải tick "rate-limit login" trước khi expose.

## BUG-4 `[MEDIUM]` Fanout `after()` bị giới hạn `maxDuration=60` khi không dùng QStash
- **Vị trí:** `src/app/api/cron/collect/route.ts:16` (`maxDuration = 60`).
- **Triệu chứng:** Khi không có `QSTASH_TOKEN`, fanout chạy tuần tự trong `after()` của cùng function — bị chặn bởi `maxDuration` (60s). Nhiều danh mục × nhiều adapter dễ vượt → job bị cắt, một số danh mục không thu thập.
- **Nguyên nhân gốc:** Đường fallback không có cơ chế chia nhỏ; giới hạn thời gian quá thấp cho fanout tuần tự.
- **Cách sửa:** Nâng `maxDuration` của cron/collect lên 300 (Pro) và **ghi rõ** khuyến nghị bật QStash khi số danh mục lớn (đã nêu ở tech ADR-02). Đây là giảm thiểu, không phải khắc phục triệt để — giải pháp bền vững là QStash/queue.
- **Phòng ngừa:** Ở môi trường nhiều danh mục, coi QStash là bắt buộc; giám sát thời lượng run (observability) để phát hiện cắt timeout.

# Ghi chú mức thấp (không sửa ngay)
- `[LOW]` `checkOrigin` bỏ qua khi request không gửi `Origin` — chấp nhận (fetch same-origin có thể thiếu Origin); cân nhắc thêm kiểm `Sec-Fetch-Site` khi cần chặt hơn.
- `[LOW]` `ensureAdminSeeded()` chạy mỗi lần `authorize` (upsert) — chi phí nhỏ, chấp nhận ở quy mô 1 admin.
