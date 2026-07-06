---
integration: i-20260706231719-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: frd
status: approved
open_questions: 0
updated: 2026-07-06
---

# Tóm Tắt Tính Năng

Xây dựng ứng dụng **Bản tin hàng ngày (Daily News Digest)** trên **Next.js + Vercel**, DB **MongoDB**.
Mỗi ngày hệ thống tự động thu thập **Top N (mặc định 10) tin nổi bật trong 24 giờ trước** cho **từng danh mục** (ví dụ: AI, giá vàng…), tìm kiếm ở cả **Việt Nam và thế giới** thông qua các công cụ **Perplexity API, Apify, Firecrawl**, lưu vào MongoDB (có lịch sử + chống trùng), rồi **gửi email bản tin** tới danh sách người nhận đăng ký theo danh mục.

**Phạm vi (in-scope):**
- CRUD **Danh mục** (category) + danh sách **email người nhận** theo từng danh mục, qua **giao diện admin có đăng nhập**.
- **Thu thập tự động** theo lịch: bước thu thập lúc 6:00 (giờ cấu hình), bước gửi email lúc 6:30.
- Xếp hạng "nổi bật" bằng **kết hợp AI (lọc liên quan) + tương tác (engagement)**.
- Lưu trữ lịch sử tin + **chống trùng lặp** giữa các ngày.
- **Không hardcode** — mọi cấu hình (API keys, DB URI, múi giờ, ngôn ngữ, giờ chạy, Top N, sender email, dedup window…) đặt ở **file env**.
- Nếu **thiếu env key** của một công cụ ⇒ **không dùng công cụ đó** (bỏ qua, không gây lỗi cả tiến trình).

**Ngoài phạm vi (out-of-scope):**
- **NotebookLM**: không có API công khai ⇒ không tích hợp tự động (chỉ dùng thủ công nếu cần, ngoài luồng).
- Multi-tenant / nhiều tổ chức (giai đoạn này chỉ 1 người dùng — admin cá nhân).
- Double opt-in đầy đủ và quản lý người nhận quy mô lớn (xem giả định & rủi ro).

# Mục Tiêu Nghiệp Vụ

- **Business Goal:** Mỗi sáng tự động có bản tổng hợp tin nổi bật theo chủ đề quan tâm mà không phải tự đi tìm.
- **Business Value:** Tiết kiệm thời gian; tập trung tin quan trọng 24h; mở rộng chủ đề dễ dàng qua CRUD danh mục; đa nguồn (VN + thế giới, nhiều nền tảng).
- **KPI kỳ vọng:** (1) Tỷ lệ ngày gửi email thành công/ngày ≥ 95%; (2) Mỗi danh mục đủ Top N tin hợp lệ ≥ 90% số lần chạy; (3) Tỷ lệ tin trùng lặp trong email < 5%; (4) Thời gian thu thập/danh mục nằm trong giới hạn timeout.
- **Assumptions (giả định đang dựa vào):**
  - `[A1]` Múi giờ mặc định **ICT (UTC+7)**, ngôn ngữ mặc định **tiếng Việt**, cả hai **cấu hình qua env** (giữ nguồn gốc/nguyên văn tiêu đề khi cần).
  - `[A2]` **Top N = 10** nhưng cấu hình qua env.
  - `[A3]` Giai đoạn đầu **chỉ 1 người dùng (admin)**; gửi từ **Gmail cá nhân (SMTP + App Password)** tới email cá nhân khác; cấu hình sender/nhận qua env + DB.
  - `[A4]` **Dedup window** mặc định (ví dụ 14 ngày) cấu hình qua env; chống trùng theo URL chuẩn hóa + tiêu đề.
  - `[A5]` Bước thu thập 6:00 **trả về ngay**, xử lý chạy nội bộ và lưu DB; bước gửi 6:30 đọc DB đã lưu để gửi (2 bước tách rời).
  - `[A6]` Mặc định **gửi 1 email/danh mục** tới người nhận đã đăng ký danh mục đó (định dạng digest); có thể đổi sang gộp — xem câu hỏi mở đã chốt là giả định.

# Luồng Chính

**A. Quản lý danh mục & người nhận (admin):**
1. Admin đăng nhập giao diện quản trị.
2. Tạo/Sửa/Xóa **danh mục** (tên, mô tả, từ khóa tìm kiếm, phạm vi VN/thế giới, bật/tắt, Top N override tùy chọn).
3. Với mỗi danh mục: thêm/sửa/xóa **email người nhận**.

**B. Thu thập tự động (06:00 giờ cấu hình):**
1. Cron kích hoạt endpoint thu thập → **trả về ngay** (chấp nhận job chạy nội bộ/nền).
2. Với mỗi danh mục đang bật: gọi các công cụ **có env key** (Perplexity/Firecrawl để tìm & trích xuất; Apify để lấy tương tác từ Facebook/Reddit/X/TikTok/GitHub…).
3. **Lọc liên quan bằng AI** trong 24h, **xếp hạng kết hợp engagement**, chọn **Top N**, **chống trùng** theo dedup window.
4. **Lưu kết quả vào MongoDB** (bản tin theo danh mục + ngày, kèm nguồn/điểm/URL) và trạng thái chạy (run log).

**C. Gửi email (06:30 giờ cấu hình):**
1. Cron kích hoạt endpoint gửi → đọc bản tin đã lưu cho ngày hiện tại.
2. Render email digest cho từng danh mục → gửi tới danh sách người nhận qua Gmail SMTP.
3. Ghi trạng thái gửi (thành công/thất bại từng người nhận) vào DB.

# Luồng Thay Thế

- **AT-1:** Danh mục không có người nhận → vẫn thu thập & lưu DB, **bỏ qua gửi** (log lý do).
- **AT-2:** Chỉ một số env key có mặt → chỉ dùng công cụ tương ứng; ghi rõ công cụ bị bỏ qua.
- **AT-3:** Top N override theo danh mục → dùng giá trị override thay cho mặc định env.
- **AT-4:** Chạy thủ công (admin bấm "chạy ngay" cho 1 danh mục) — tùy chọn tiện ích, không thay lịch tự động.

# Luồng Ngoại Lệ

- **EX-1:** Một công cụ trả lỗi/timeout/rate-limit → **retry có giới hạn**, rồi tiếp tục với dữ liệu công cụ khác; không làm hỏng cả run.
- **EX-2:** Thu thập chưa đủ N tin hợp lệ → gửi số tin có được + ghi chú "chỉ tìm được k/N".
- **EX-3:** Gửi email thất bại một phần → retry người nhận lỗi; ghi trạng thái từng người; không chặn người còn lại.
- **EX-4:** Bước gửi 6:30 chạy nhưng bước thu thập 6:00 thất bại/chưa xong → phát hiện thiếu dữ liệu ngày → **không gửi email rỗng**, cảnh báo admin.
- **EX-5:** MongoDB không kết nối được → dừng an toàn, ghi log/cảnh báo, không mất trạng thái các bước đã thành công.

# Logic Còn Thiếu

- `[HIGH]` Chưa định nghĩa **thuật toán chuẩn hóa điểm engagement** khi trộn nhiều nền tảng có thang đo khác nhau (upvote Reddit vs like TikTok). Cần công thức chuẩn hóa/trọng số (_Business Rules Analysis_).
- `[HIGH]` Chưa rõ **cửa sổ 24h tính theo mốc nào** (giờ đăng bài theo nguồn vs giờ chạy) và cách xử lý lệch múi giờ giữa nguồn VN/thế giới (_Non-Functional Requirements Analysis_).
- `[MEDIUM]` **Kết nối bước thu thập (async, trả về ngay) trên môi trường Vercel serverless**: cách bảo đảm job chạy tới cùng sau khi HTTP đã trả về (background execution) chưa chốt — để bước /tn-thiet-ke quyết (waitUntil/queue).
- `[MEDIUM]` Chưa có quy tắc **hợp nhất tin trùng từ nhiều nguồn thành 1 mục** (cùng sự kiện, khác URL).
- `[MEDIUM]` Chưa định nghĩa **định dạng/mẫu email** (thứ tự tin, hiển thị nguồn, ảnh, tóm tắt AI).

# Business Rule Còn Thiếu

- `[HIGH]` **Chống trùng**: tin đã xuất hiện trong dedup window không được gửi lại — cần khóa duy nhất theo `(category, normalizedUrl)` và/hoặc fingerprint tiêu đề.
- `[MEDIUM]` **Điều kiện "nổi bật" tối thiểu** (ngưỡng liên quan/engagement) để loại tin rác.
- `[MEDIUM]` **Chỉ gửi 1 lần/ngày/danh mục** (chống gửi lặp nếu cron chạy lại).
- `[LOW]` Quy tắc **giữ nguyên ngôn ngữ nguồn vs dịch** khi bản tin đặt tiếng Việt nhưng tin gốc tiếng Anh.

# Validation Còn Thiếu

- `[HIGH]` **Email người nhận**: định dạng hợp lệ, chống trùng trong cùng danh mục.
- `[HIGH]` **Danh mục**: tên bắt buộc, chống trùng tên; ít nhất 1 từ khóa/tiêu chí tìm kiếm.
- `[MEDIUM]` **Top N override**: số nguyên dương, chặn giá trị vô lý (ví dụ > 50).
- `[MEDIUM]` **Env bắt buộc tối thiểu** (DB URI, ít nhất 1 công cụ thu thập, SMTP) — kiểm tra khi khởi động, báo lỗi rõ ràng.
- `[LOW]` **Từ khóa/scope** VN/thế giới hợp lệ (enum).

# Phân Quyền Còn Thiếu

- `[CRITICAL]` **Toàn bộ CRUD danh mục & email và endpoint chạy thủ công phải yêu cầu admin đăng nhập** — không để công khai (chống lạm dụng, chống thêm email bừa bãi → spam người khác).
- `[HIGH]` **Endpoint cron (thu thập/gửi)** phải được **bảo vệ bằng secret** (Vercel Cron secret / header token) để không ai gọi tùy tiện gây tốn quota công cụ trả phí.
- `[MEDIUM]` Không có nhu cầu phân quyền nhiều vai trò ở giai đoạn 1 (chỉ 1 admin) — SoD chưa áp dụng (ghi nhận để mở rộng sau).

# Trạng Thái Còn Thiếu

- `[HIGH]` **Trạng thái run theo ngày/danh mục**: `pending → collecting → collected → sending → sent | failed | partial` — cần định nghĩa để phối hợp 2 bước (6:00 và 6:30) và chống gửi email rỗng.
- `[MEDIUM]` **Trạng thái từng người nhận**: `queued → sent → failed(retryable/permanent)`.
- `[LOW]` Trạng thái **danh mục** enabled/disabled đã có; cần trạng thái "đang tạm dừng do lỗi liên tục".

# Thông Báo Còn Thiếu

- `[HIGH]` **Cảnh báo admin khi run thất bại/partial** (thu thập lỗi, thiếu dữ liệu, gửi lỗi) — kênh nào (email admin?) chưa chốt.
- `[MEDIUM]` **Link hủy đăng ký (unsubscribe)** trong email — bắt buộc khi mở rộng nhiều người nhận (chống spam/tuân thủ). Giai đoạn 1 (gửi cho chính mình) có thể tạm hoãn nhưng nên có (ghi nhận).
- `[LOW]` Xử lý **email gửi thất bại lặp lại** → thông báo/tắt người nhận lỗi.

# Audit Còn Thiếu

- `[HIGH]` **Run log**: mỗi lần thu thập/gửi lưu thời điểm, công cụ dùng, số tin, lỗi, người nhận thành công/thất bại (truy vết & gỡ lỗi).
- `[MEDIUM]` **Change history** cho CRUD danh mục & email (ai sửa, khi nào) — hữu ích cả khi 1 người.
- `[LOW]` Lưu **chi phí/quota** gọi công cụ trả phí theo ngày (giám sát chi phí).

# Edge Cases

| Edge Case | Kỳ vọng xử lý | Mức rủi ro |
| --------- | ------------- | ---------- |
| Không có công cụ nào có env key | Bỏ qua thu thập, cảnh báo admin, không gửi email rỗng | `[HIGH]` |
| Công cụ trả 0 kết quả cho danh mục | Ghi "0 tin", không gửi hoặc gửi thông báo trống theo cấu hình | `[MEDIUM]` |
| Cùng tin xuất hiện nhiều nền tảng | Hợp nhất/chống trùng, tính engagement tổng hợp | `[HIGH]` |
| Cron chạy trùng/hai lần (retry của Vercel) | Idempotent theo `(ngày, danh mục, bước)`, không gửi lặp | `[HIGH]` |
| Đổi múi giờ env sau khi đã lên lịch | Lịch cron Vercel cố định UTC — cần đồng bộ lại; tài liệu hóa | `[MEDIUM]` |
| Danh mục bị xóa giữa lúc đang thu thập | Bỏ qua an toàn, không ghi bản tin mồ côi | `[MEDIUM]` |
| Email người nhận sai định dạng | Chặn khi nhập; bỏ qua khi gửi + log | `[MEDIUM]` |
| Vượt giới hạn gửi Gmail (~500/ngày) | Giai đoạn 1 không chạm; tài liệu hóa giới hạn cho mở rộng | `[LOW]` |
| Quota công cụ trả phí cạn giữa chừng | Dừng công cụ đó, dùng dữ liệu đã có, cảnh báo | `[MEDIUM]` |
| Tin không phải tiếng Việt khi bản tin đặt tiếng Việt | Giữ nguyên/tóm tắt theo cấu hình ngôn ngữ | `[LOW]` |

# Ảnh Hưởng Tính Năng Khác

- `[LOW]` Không phát hiện xung đột — đây là **hệ thống mới (greenfield)**, chưa có tính năng hiện hữu trong `.spec/main/`. Ghi nhận để các integration sau đối chiếu.

# Ảnh Hưởng Component Dùng Chung

> Greenfield — chưa có component dùng chung. Bảng dưới ghi các component **sẽ hình thành** và cần thiết kế tái sử dụng.

| Component dùng chung | Tính năng bị ảnh hưởng | Regression Risk |
| -------------------- | ---------------------- | --------------- |
| Config/env loader (không hardcode) | Toàn hệ thống | `[MEDIUM]` |
| MongoDB connection + models | Thu thập, gửi, CRUD | `[MEDIUM]` |
| Tool adapters (Perplexity/Apify/Firecrawl) | Bước thu thập | `[HIGH]` |
| Auth admin | Toàn bộ trang quản trị + API | `[HIGH]` |

# Rủi Ro Dữ Liệu

- `[HIGH]` **Trùng lặp tin** giữa các ngày/nguồn nếu dedup key không chặt (URL có tham số, redirect).
- `[MEDIUM]` **Orphan data**: bản tin trỏ danh mục đã xóa; run log trỏ danh mục đã xóa.
- `[MEDIUM]` **Phình dữ liệu** khi lưu lịch sử dài — cần TTL/retention cấu hình.
- `[LOW]` Không nhất quán khi bước 6:00 lưu 1 phần rồi lỗi — cần đánh dấu run partial.

# Rủi Ro Bảo Mật

- `[CRITICAL]` **Lộ CRUD email công khai** → người lạ thêm email nạn nhân → hệ thống trở thành công cụ spam. ⇒ Bắt buộc auth admin (đã chốt).
- `[CRITICAL]` **Rò rỉ secrets** (API keys trả phí, Gmail App Password, DB URI) nếu lộ env/log. ⇒ Không log secret, chỉ để env.
- `[HIGH]` **Endpoint cron không bảo vệ** → bị gọi để đốt quota trả phí hoặc gửi spam. ⇒ Bảo vệ bằng cron secret.
- `[MEDIUM]` **SSRF/nội dung độc hại** khi crawl URL bất kỳ (Firecrawl) — cần giới hạn/kiểm soát.
- `[MEDIUM]` **Injection nội dung** vào email (HTML từ nguồn) → cần sanitize khi render.

# Rủi Ro Đồng Thời

- `[HIGH]` **Cron chạy lặp / hai bước chồng nhau** → gửi email trùng hoặc ghi bản tin trùng. ⇒ Khóa idempotent theo `(ngày, danh mục, bước)`.
- `[MEDIUM]` **Admin sửa danh mục lúc đang thu thập** → dùng bản chụp cấu hình đầu run.
- `[MEDIUM]` **Nhiều tool trả về song song** ghi cùng bản tin → cần gộp có khóa.

# Rủi Ro Mở Rộng

- `[HIGH]` **Số danh mục tăng** → tổng thời gian thu thập vượt timeout serverless (đã chọn tách bước + chạy nội bộ; có thể cần queue khi scale — để tech quyết).
- `[MEDIUM]` **Nhiều người nhận / nhiều domain** → cần chuyển từ Gmail SMTP sang dịch vụ email chuyên dụng + double opt-in + unsubscribe.
- `[MEDIUM]` **Chi phí công cụ trả phí** tăng tuyến tính theo số danh mục/nguồn — cần giám sát & giới hạn.
- `[LOW]` Đa ngôn ngữ/đa múi giờ nhiều người dùng — hiện đã tách config qua env, mở rộng cần theo người dùng.

# Các Câu Hỏi Cần Làm Rõ

> Tất cả câu hỏi **chặn** đã được giải quyết trong 2 vòng hỏi (không còn open question chặn). Các mục dưới là **đã chốt** hoặc **giả định tường minh** để bước sau tinh chỉnh:

1. ✅ **Công cụ bắt buộc:** Perplexity API, Apify, Firecrawl (thiếu env key ⇒ không dùng công cụ đó). **NotebookLM ngoài phạm vi** (không API).
2. ✅ **Lịch chạy:** 6:00 thu thập (trả về ngay, chạy nội bộ, lưu DB) → 6:30 gửi email. Múi giờ **cấu hình qua env** (mặc định ICT).
3. ✅ **Xác thực admin:** bắt buộc đăng nhập cho CRUD danh mục & email.
4. ✅ **Email:** giai đoạn 1 dùng **Gmail cá nhân (SMTP)** gửi tới email cá nhân khác (cấu hình env). Nhà cung cấp chuyên dụng + unsubscribe để dành mở rộng.
5. ✅ **Xếp hạng nổi bật:** kết hợp **AI lọc liên quan + engagement**. (Công thức trọng số cụ thể → chốt ở /tn-thiet-ke.)
6. ✅ **Ngôn ngữ:** cấu hình qua env (mặc định tiếng Việt).
7. ✅ **Lưu trữ:** lưu lịch sử + chống trùng (dedup theo URL/tiêu đề, window qua env).
8. 🟡 **Giả định [A6]:** mặc định 1 email/danh mục. Nếu muốn gộp tất cả danh mục vào 1 email/người → xác nhận ở bước thiết kế (không chặn).

# Đề Xuất Cải Tiến

- `[Cao]` Định nghĩa **contract chung cho tool adapter** (input: từ khóa+scope+window; output: danh sách tin chuẩn hóa {title,url,source,publishedAt,engagement,summary}) để dễ bật/tắt và thêm công cụ mới không sửa lõi.
- `[Cao]` **Bảng run log + trạng thái theo ngày/danh mục** để chống gửi rỗng/trùng và giám sát.
- `[Trung bình]` **Trang admin "xem trước bản tin"** trước khi gửi (giai đoạn 1 hữu ích để tinh chỉnh tiêu chí).
- `[Trung bình]` **Cấu hình retention/TTL** cho tin lịch sử để kiểm soát dung lượng Mongo.
- `[Trung bình]` **Unsubscribe token + trang hủy** thiết kế sớm dù chưa bật, để mở rộng nhiều người nhận an toàn.
- `[Thấp]` **Chuẩn hóa & giám sát chi phí** gọi công cụ trả phí theo ngày.
