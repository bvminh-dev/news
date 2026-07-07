# Live-spec — i-20260708000200-ban-tin-hang-ngay

## [2026-07-08] /tn-yeu-cau → /tn-code (i-20260708000200-ban-tin-hang-ngay)
- Skill/nguồn: yêu cầu trực tiếp của người dùng (2 quyết định chốt qua hỏi-đáp).
- Bối cảnh: user chạy run-now thấy "không có kết quả" → kiểm tra DB thấy tin CÓ (20 doc/ngày, rank trùng do chạy lại). User chốt 2 hành vi mới cho run-now.
- Quyết định người dùng:
  1. Data cũ trong ngày: **giữ cả hai, đẩy cũ xuống +N**, tin mới re-rank lên đầu (KHÔNG thay thế).
  2. Gửi email: **gửi lại cho TẤT CẢ** (reset delivery_logs hôm nay).
- Việc đã làm (code):
  - `services/collect.ts`: thêm `opts.force`; `force` bỏ qua idempotency no-op; trước upsert, `updateMany({categoryId,date}, {$inc:{rank: ranked.length}})` đẩy tin cũ xuống.
  - `services/send.ts`: `sendCategory` thêm `.limit(topN)` (email = bộ tin mới trên đầu); thêm `resetDeliveries(categoryId,date)` (deleteMany delivery_logs).
  - `app/api/admin/run-now/route.ts`: collect `{force:true}`; nếu status collected/partial → `resetDeliveries` + `sendCategory`; trả `{date,result,send}`. Guard: collect failed → không reset/không gửi.
- Verify: `tsc` sạch; vitest **50/50 PASS** (thêm FT-RN-1 shift rank, FT-RN-2 send-limit trong collect-db.test.ts với mongodb-memory-server). Route run-now end-to-end (gửi email thật) để admin bấm — chưa tự chạy (side-effect ra ngoài).
- Lệch/ghi chú: đã sang ngày 2026-07-08 ⇒ run-now chạy cho ngày mới, không đụng 20 tin ngày 07. Cron 06:00/06:30 KHÔNG đổi (force mặc định false; .limit an toàn vì cron chỉ ghi N tin).
