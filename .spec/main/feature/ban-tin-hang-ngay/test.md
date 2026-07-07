---
integration: i-20260706231719-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: test
status: approved
open_questions: 0
updated: 2026-07-06
---

# Phân Tích Requirement

> [i-20260707223448] thay thế: nguồn AI "Perplexity" → "Claude" trong mọi test case (tên `tools=[perplexity]` → `[claude]`, `PERPLEXITY_API_KEY` → `ANTHROPIC_API_KEY`); logic test không đổi. UT-16 đã cập nhật khóa env `anthropicKey` và PASS.
> [i-20260707223448] bổ sung: xác thực Claude bằng `ANTHROPIC_AUTH_TOKEN` (OAuth) — thêm UT-16d (chỉ token → 1 adapter claude) + UT-16e (key+token → ưu tiên token). Toàn bộ suite **48/48 PASS**.
> [i-20260708000200] bổ sung run-now (force + email): thêm FT-RN-1 (đẩy rank tin cũ +N, tin mới rank 1..N, giữ cả hai) + FT-RN-2 (send `.limit(topN)` → bộ tin mới). Suite **50/50 PASS**.

**Phạm vi kiểm thử:** ứng dụng Bản tin hàng ngày (Next.js/Vercel + MongoDB).
- **Admin UI/API:** đăng nhập; CRUD **danh mục** (name/keywords/scope/topN/enabled/lang); CRUD **email người nhận** theo danh mục; preview; run-now.
- **Thu thập (06:00):** fan-out per-category; adapter registry theo env; chuẩn hóa + dedup + ranking (AI relevance + engagement) → Top N; ghi `news_items` + `digest_runs`.
- **Gửi (06:30):** chỉ gửi category `collected`; render digest; gửi Gmail SMTP; ghi `delivery_logs`; idempotent.
- **Unsubscribe:** public token → set active=false.
- **Bảo mật:** guard admin/cron/worker; validate (zod); XSS/SSRF/NoSQLi; secret chỉ ENV.

**Đối tượng:** Admin (1 người); hệ thống cron/worker; người nhận email; attacker.

**Giả định (spec):** múi giờ/ngôn ngữ/topN/dedup-window/trọng số ranking cấu hình env; thiếu env key ⇒ loại adapter; 1 email/danh mục (mặc định).

# Test Conditions

- TCD-01 Đăng nhập admin: đúng/sai credential, khóa sau nhiều lần sai.
- TCD-02 Tạo danh mục: name bắt buộc + unique; ≥1 keyword; scope hợp lệ (VN/WORLD); topN dương & trần.
- TCD-03 Sửa/xóa danh mục: enabled/disabled; xóa khi đang thu thập; xóa kéo theo subscriber/news mồ côi.
- TCD-04 Thêm email người nhận: định dạng hợp lệ; chống trùng trong cùng danh mục; nhiều email.
- TCD-05 Adapter registry: đủ/thiếu/không có env key nào.
- TCD-06 Cửa sổ 24h: tin trong/ngoài 24h theo publishedAt; lệch múi giờ nguồn.
- TCD-07 Dedup: cùng URL (khác query), cùng tin khác nguồn, trùng giữa các ngày trong window.
- TCD-08 Ranking: relevance + engagement chuẩn hóa; trọng số env; đủ/không đủ N tin.
- TCD-09 Idempotency collect/send: cron chạy 2 lần cùng ngày.
- TCD-10 Không gửi email rỗng: collect fail/partial → send.
- TCD-11 Gửi 1 phần lỗi: retry người nhận lỗi; ghi trạng thái.
- TCD-12 Unsubscribe: token hợp lệ/sai/đã dùng.
- TCD-13 Bảo mật: gọi API admin/cron/worker không auth; NoSQLi; XSS nội dung nguồn; SSRF URL nội bộ; rò rỉ field nhạy cảm.
- TCD-14 Cấu hình: retention ≥ dedupWindow; thiếu env bắt buộc (DB/SMTP).

# Test Scenarios

- TS-01 Admin đăng nhập → tạo danh mục "AI" (keywords, scope=VN+WORLD) → thêm 2 email → lưu.
- TS-02 Cron 06:00 chạy đủ adapter → mỗi danh mục có Top N tin không trùng → `digest_runs=collected`.
- TS-03 Cron 06:30 → gửi digest tới người nhận → `delivery_logs=sent`; chạy lại 06:30 → không gửi trùng.
- TS-04 Chỉ có `ANTHROPIC_API_KEY` (thiếu Firecrawl/Apify) → vẫn thu thập bằng Claude, engagement=0, xếp theo relevance. (i-20260707223448)
- TS-05 Không có env key nào → không thu thập → `digest_runs=failed` → 06:30 không gửi rỗng → alert admin.
- TS-06 Tin trùng giữa hôm nay và trong dedup window → bị loại, không gửi lại.
- TS-07 Người nhận bấm unsubscribe → active=false → lần gửi sau không nhận.
- TS-08 Attacker gọi trực tiếp `/api/admin/categories` (không session) và `/api/worker/collect` (sai secret) → 401/403.

# Test Cases

| ID | Tiền điều kiện | Bước | Dữ liệu | Kết quả mong đợi | Kỹ thuật |
|----|----------------|------|---------|------------------|----------|
| TC-01 | Chưa đăng nhập | Mở trang admin | — | Chuyển hướng trang đăng nhập; không thấy dữ liệu | *State Transition* |
| TC-02 | Có admin trong DB | Đăng nhập đúng | email+mật khẩu đúng | Vào được dashboard | *EP* |
| TC-03 | Có admin | Đăng nhập sai mật khẩu 5 lần | sai liên tục | Bị khóa tạm/thông báo; không lộ "email tồn tại?" | *Error Guessing* |
| TC-04 | Đã đăng nhập | Tạo danh mục thiếu name | name rỗng | Báo lỗi bắt buộc; không lưu | *BVA* |
| TC-05 | Đã có danh mục "AI" | Tạo danh mục trùng tên | name="AI" | Báo lỗi trùng; không lưu | *EP* |
| TC-06 | Đã đăng nhập | Tạo danh mục không keyword | keywords=[] | Báo lỗi ≥1 keyword | *BVA* |
| TC-07 | Đã đăng nhập | Tạo danh mục topN=0 và topN=51 | 0 / 51 | Từ chối (ngoài [1..50]) | *BVA* |
| TC-08 | Có danh mục | Thêm email sai định dạng | "abc@", "a b@x.com" | Báo lỗi định dạng | *EP* |
| TC-09 | Danh mục có email X | Thêm lại email X | trùng | Báo trùng; không tạo bản ghi 2 | *EP* |
| TC-10 | Có danh mục enabled + đủ env | Chạy collect | — | Mỗi danh mục ≤ topN tin, không trùng, `collected` | *Decision Table* |
| TC-11 | Chỉ có Claude key | Chạy collect | thiếu Firecrawl/Apify | Thu thập được, engagement=0, tools=[claude] | *Decision Table* |
| TC-12 | Không env key nào | Chạy collect | — | `failed`, alert admin, không tạo tin | *Decision Table* |
| TC-13 | Đã collect hôm nay | Chạy collect lần 2 cùng ngày | same date | Idempotent: không tạo tin trùng/không ghi đè sai | *State Transition* |
| TC-14 | Có tin URL `x?utm=1` hôm qua (trong window) | Collect thấy `x?utm=2` | cùng URL chuẩn hóa | Bị dedup, không thêm | *Error Guessing* |
| TC-15 | Có `collected` + subscriber | Chạy send | — | Gửi tới từng email, `sent` | *EP* |
| TC-16 | Đã send hôm nay | Chạy send lần 2 | same date | Không gửi trùng (idempotent theo (date,cat,email)) | *State Transition* |
| TC-17 | collect `failed` | Chạy send | — | Không gửi email rỗng; alert | *Decision Table* |
| TC-18 | Send, 1 email SMTP lỗi | Chạy send | 1 email lỗi tạm | Retry; ghi failed cho email đó; email khác vẫn `sent`; run=partial | *Error Guessing* |
| TC-19 | Có subscriber + token | Mở link unsubscribe | token đúng | active=false; trang xác nhận; lần sau không gửi | *State Transition* |
| TC-20 | — | Mở unsubscribe token sai | token bịa | Không tắt ai; thông báo generic, không lộ email | *Negative* |
| TC-21 | Danh mục không có subscriber | Chạy send | — | Bỏ qua gửi, log lý do, không lỗi | *Decision Table* |
| TC-22 | Đủ nguồn nhưng chỉ tìm được 4 tin | Collect (topN=10) | 4 tin | Lưu 4 tin, ghi chú "4/10"; gửi 4 | *BVA* |

# Boundary Values

| Trường | Min-1 | Min | Max | Max+1 | Kết quả mong đợi |
|--------|-------|-----|-----|-------|------------------|
| topN (per category) | 0 | 1 | 50 | 51 | Chỉ [1..50] hợp lệ |
| keywords count | 0 | 1 | (hợp lý, vd 20) | 21 | ≥1 bắt buộc; trần chống lạm dụng |
| keyword length | 0 | 1 | 100 | 101 | Chặn quá dài (DoS/quota) |
| Số tin tìm được vs topN | — | 0 | topN | >topN | 0→không gửi; >topN→cắt còn topN |
| DEDUP_WINDOW_DAYS | — | 1 | = retention | > retention | Phải ≤ retention (fail-fast) |
| Số email/danh mục | — | 0 | (vd 500 - giới hạn Gmail) | >giới hạn | Cảnh báo khi vượt giới hạn gửi |

# Equivalence Partitions

| Trường | Phân vùng hợp lệ | Phân vùng không hợp lệ |
|--------|------------------|------------------------|
| email người nhận | `a@b.com`, `x.y@z.co` | rỗng, `abc@`, `@x.com`, chứa khoảng trắng, object `{$ne:null}` |
| scope | VN, WORLD, cả hai | giá trị ngoài enum |
| name danh mục | chuỗi non-empty unique | rỗng, trùng, chỉ khoảng trắng |
| topN | 1..50 | ≤0, >50, không phải số |
| env adapter key | có giá trị hợp lệ | rỗng/thiếu → loại adapter |
| unsubscribe token | token ngẫu nhiên khớp | rỗng, sai, đã vô hiệu |

# Decision Table

| Rule | Có ≥1 adapter env key? | Có tin trong 24h? | Đủ topN? | Có subscriber? | Hành động / Kết quả |
|------|------------------------|-------------------|----------|----------------|---------------------|
| R1 | Có | Có | Có | Có | Collect Top N → 06:30 gửi đủ |
| R2 | Có | Có | Không (k<N) | Có | Lưu k tin, gửi k, ghi chú thiếu |
| R3 | Có | Không | — | Có | 0 tin; không gửi rỗng, log/alert |
| R4 | Không | — | — | — | `failed`, alert, 06:30 không gửi |
| R5 | Có | Có | Có | Không | Collect & lưu; bỏ qua gửi |
| R6 | Có (collect fail 1 phần) | Có | — | Có | run=partial; gửi phần có, alert |

# State Transition Matrix

| State hiện tại (DigestRun) | Event | State kế tiếp | Hợp lệ? |
|----------------------------|-------|---------------|---------|
| (none) | collect start | collecting | ✔ |
| collecting | rank+ghi xong | collected | ✔ |
| collecting | lỗi toàn bộ | failed | ✔ |
| collecting | lỗi 1 phần | partial | ✔ |
| collected | send start | sending | ✔ |
| sending | gửi hết OK | sent | ✔ |
| sending | 1 phần lỗi | partial(sent) | ✔ |
| failed | send start | (chặn) | ✘ Không gửi rỗng |
| sent | send lại cùng ngày | sent (no-op) | ✔ idempotent |
| collected | collect lại cùng ngày | collected (no-op) | ✔ idempotent |

# Permission Matrix

| Role | Create Cat | View Cat | Edit Cat | Delete Cat | CRUD Email | Run-now | View Runs | Unsubscribe |
|------|-----------|----------|----------|-----------|------------|---------|-----------|-------------|
| Admin (đăng nhập) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Vô danh (không session) | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | Chỉ qua token (set active=false) |
| Cron/Worker (secret) | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ (trigger) | ✘ | ✘ |

(✘ = phải bị chặn 401/403; ✔ = cho phép)

# Negative Test Cases

- `[CRITICAL]` NoSQL Injection: gửi `email={"$ne":null}` hoặc `id={"$gt":""}` vào API admin → phải bị zod từ chối, không truy vấn.
- `[CRITICAL]` Gọi `/api/admin/categories` (POST/PATCH/DELETE) không session → 401; không thực hiện.
- `[HIGH]` Gọi `/api/worker/collect` sai/thiếu `CRON_SECRET` → 401; ghi log nghi tấn công.
- `[HIGH]` Tạo danh mục name chỉ khoảng trắng/emoji/unicode 200 ký tự → validate đúng.
- `[MEDIUM]` XSS: nguồn tin có `<script>`/`<img onerror>` trong title/summary → preview & email escape/sanitize, không thực thi.
- `[MEDIUM]` SSRF: keyword/URL ép Firecrawl crawl `http://169.254.169.254/` hoặc `localhost` → bị chặn.
- `[MEDIUM]` unsubscribe token rỗng/sai định dạng → không lỗi 500, thông báo generic.
- `[LOW]` Payload cực lớn (keyword 100k ký tự) → bị chặn theo giới hạn.

# Edge Cases

- `[HIGH]` Cron chạy 2 lần (Vercel retry) → idempotent, không gửi/ghi trùng.
- `[HIGH]` 06:30 chạy trước khi 06:00 xong → phát hiện chưa `collected` → hoãn/không gửi rỗng + alert.
- `[MEDIUM]` Danh mục bị xóa giữa lúc collect → bỏ qua an toàn, không ghi tin mồ côi.
- `[MEDIUM]` Tin `publishedAt` đúng ranh giới 24h (00:00:00 vs 23:59:59) → BVA theo mốc window.
- `[MEDIUM]` Lệch múi giờ: nguồn ghi giờ địa phương khác → chuẩn hóa UTC trước so sánh.
- `[MEDIUM]` Apify actor treo/timeout → engagement=0, tiếp tục bằng relevance.
- `[LOW]` Tin tiếng Anh khi lang=vi → giữ nguyên/tóm tắt theo cấu hình.
- `[LOW]` 0 danh mục enabled → collect no-op, không lỗi.

# API Test Cases

- `[CRITICAL]` `/api/admin/*`: không session → 401; sai method chưa guard → không được bypass (test đủ GET/POST/PATCH/DELETE).
- `[HIGH]` `/api/cron/collect|send`: đúng `CRON_SECRET` → 202; sai/thiếu → 401.
- `[HIGH]` `/api/worker/collect|send`: chữ ký QStash/secret hợp lệ → xử lý idempotent; lặp lại → 200 no-op.
- `[MEDIUM]` Response admin: schema không chứa `passwordHash`/`unsubscribeToken`/secret (projection/DTO).
- `[MEDIUM]` `/api/public/unsubscribe/:token`: token đúng → 200 + active=false; sai → 200/404 generic (không phân biệt để tránh enumerate).
- `[MEDIUM]` Rate-limit: gọi login/unsubscribe/run-now vượt ngưỡng → 429.
- `[LOW]` Pagination danh sách subscriber/news khi lớn.

# Security Test Cases

- `[CRITICAL]` Broken Access Control: vô danh CRUD danh mục/email → chặn (test từng endpoint & method).
- `[CRITICAL]` Privilege Escalation: đoán/sửa cookie session → không lên admin; `NEXTAUTH_SECRET` bảo vệ.
- `[HIGH]` CSRF: form độc ép admin POST/DELETE → chặn bởi SameSite + kiểm Origin/token.
- `[HIGH]` Secret leakage: kích lỗi 500 → không lộ stack/secret; log không chứa key/PII.
- `[MEDIUM]` XSS stored qua nội dung nguồn (email + preview).
- `[MEDIUM]` SSRF Firecrawl (IP nội bộ/metadata).
- `[MEDIUM]` Session cookie flags HttpOnly/Secure/SameSite; logout thu hồi.

# Concurrency Test Cases

- `[HIGH]` 2 lần cron collect cùng ngày song song → chỉ 1 ghi thành công theo unique key, không tin trùng.
- `[HIGH]` collect (06:00) chưa xong mà send (06:30) chạy → send thấy chưa `collected` → không gửi.
- `[MEDIUM]` Admin sửa danh mục ngay khi worker đang thu thập → worker dùng snapshot cấu hình đầu run (không lỗi giữa chừng).
- `[MEDIUM]` 2 worker cùng ghi 1 NewsItem (cùng URL) → unique index chặn trùng.

# Integration Test Cases

- `[HIGH]` Perplexity timeout/500 → retry→bỏ qua, dùng adapter khác; run vẫn ra kết quả (partial nếu thiếu).
- `[HIGH]` Mongo mất kết nối giữa collect → dừng an toàn, không mất dữ liệu đã commit; chạy lại idempotent.
- `[MEDIUM]` Apify trả dữ liệu sai schema → ACL adapter loại bỏ item lỗi, không vỡ pipeline.
- `[MEDIUM]` Gmail SMTP auth fail (App Password sai) → alert admin, không crash.
- `[MEDIUM]` QStash không có token → fallback waitUntil tuần tự (vẫn chạy).

# Regression Risks

| Hạng mục bị ảnh hưởng | Lý do | Regression Risk |
|-----------------------|-------|-----------------|
| Config/env loader | Mọi tính năng đọc env | `[MEDIUM]` |
| Adapter Registry | Bật/tắt adapter theo env | `[HIGH]` |
| Auth guard (middleware) | Bảo vệ mọi route admin/cron | `[HIGH]` |
| Repository/Mongo indexes | Dedup + idempotency phụ thuộc index | `[HIGH]` |
| Ranking/Dedup core | Đổi trọng số/thuật toán ảnh hưởng kết quả | `[MEDIUM]` |

# Missing Test Coverage

- `[HIGH]` Chưa chốt **công thức chuẩn hóa engagement** ⇒ test ranking hiện ở mức hành vi (đủ/thiếu N, thứ tự tương đối), cần bổ sung khi chốt ở /tn-code.
- `[MEDIUM]` Chưa có test **tải** (N danh mục lớn → timeout/quota) — cần khi scale.
- `[MEDIUM]` Chưa có test **định dạng email** cụ thể (layout) — phụ thuộc template chốt sau.
- `[LOW]` Coverage đa ngôn ngữ (dịch vs giữ nguyên) mức nhẹ.

# Dự Đoán Bug Tiềm Ẩn

- `[CRITICAL]` Quên guard 1 HTTP method (vd DELETE) trên route admin ⇒ vượt quyền.
- `[CRITICAL]` Truyền object request thẳng vào Mongo filter ⇒ NoSQL injection.
- `[HIGH]` Dedup theo URL thô (không chuẩn hóa query/redirect) ⇒ gửi tin trùng.
- `[HIGH]` Send không kiểm `digest_runs.status` ⇒ gửi email rỗng khi collect fail.
- `[HIGH]` Thiếu unique key idempotency ⇒ cron retry gửi/ghi trùng.
- `[MEDIUM]` `dangerouslySetInnerHTML` nội dung nguồn ⇒ stored XSS.
- `[MEDIUM]` So sánh window theo giờ máy thay vì UTC ⇒ lọt/rớt tin ranh giới 24h.
- `[MEDIUM]` Trả dư field (hash/token) trong response admin ⇒ rò rỉ.
- `[LOW]` `retention < dedupWindow` không được chặn ⇒ dedup mất dữ liệu đối chiếu.

# Khuyến Nghị Kiểm Thử

- `[Ưu tiên 1]` Test **Broken Access Control** trước (mọi endpoint × method × không-auth/sai-secret) — rủi ro CRITICAL.
- `[Ưu tiên 2]` Test **idempotency + không gửi rỗng** (cron retry, collect fail → send) — bảo vệ nghiệp vụ cốt lõi.
- `[Ưu tiên 3]` Test **dedup + Top N + adapter registry theo env** — trái tim tính năng.
- `[Ưu tiên 4]` Test **validation/injection** (zod, NoSQLi, email format, boundary topN/keyword).
- `[Ưu tiên 5]` Test **tích hợp lỗi** (timeout/retry/fallback) + **XSS/SSRF**.
- **Lỗ hổng spec cần chốt ở /tn-code:** công thức chuẩn hóa engagement; cơ chế CSRF cụ thể; template email. (Không chặn — có mặc định.)

# E2E Locators

> Ưu tiên `data-testid` ổn định; mô tả bằng lời, KHÔNG sinh code Playwright/Cypress. Back-prop: nếu /tn-code đặt testid khác → cập nhật ngược bảng này.

| Element / Mục đích | data-testid đề xuất | Màn hình / Ngữ cảnh | Ghi chú |
|--------------------|---------------------|---------------------|---------|
| Ô nhập email đăng nhập | `login-email-input` | Trang đăng nhập | — |
| Ô nhập mật khẩu | `login-password-input` | Trang đăng nhập | — |
| Nút đăng nhập | `login-submit-btn` | Trang đăng nhập | — |
| Thông báo lỗi đăng nhập | `login-error-msg` | Trang đăng nhập | generic, không lộ email tồn tại |
| Nút đăng xuất | `logout-btn` | Header admin | — |
| Nút "Thêm danh mục" | `category-add-btn` | Danh sách danh mục | Mở form tạo |
| Ô nhập tên danh mục | `category-name-input` | Form danh mục | — |
| Ô nhập keywords | `category-keywords-input` | Form danh mục | tag/CSV |
| Chọn scope VN/WORLD | `category-scope-select` | Form danh mục | multi |
| Ô nhập topN | `category-topn-input` | Form danh mục | [1..50] |
| Công tắc enabled | `category-enabled-toggle` | Form/hàng danh mục | — |
| Nút lưu danh mục | `category-save-btn` | Form danh mục | — |
| Lỗi validate danh mục | `category-form-error` | Form danh mục | name bắt buộc/trùng/keyword |
| Hàng danh mục theo id | `category-row-{id}` | Danh sách danh mục | — |
| Nút sửa danh mục | `category-edit-btn-{id}` | Hàng danh mục | — |
| Nút xóa danh mục | `category-delete-btn-{id}` | Hàng danh mục | Có xác nhận |
| Xác nhận xóa | `confirm-delete-btn` | Modal xác nhận | — |
| Vùng quản lý email của danh mục | `subscriber-panel-{categoryId}` | Chi tiết danh mục | — |
| Ô nhập email người nhận | `subscriber-email-input` | Panel email | — |
| Nút thêm email | `subscriber-add-btn` | Panel email | — |
| Lỗi email (định dạng/trùng) | `subscriber-error-msg` | Panel email | — |
| Hàng email theo id | `subscriber-row-{id}` | Panel email | — |
| Nút xóa email | `subscriber-delete-btn-{id}` | Panel email | — |
| Nút "Chạy ngay" (run-now) | `run-now-btn-{categoryId}` | Chi tiết danh mục | Chỉ admin |
| Nút xem trước bản tin | `digest-preview-btn-{categoryId}` | Chi tiết danh mục | — |
| Vùng preview bản tin | `digest-preview-content` | Modal/preview | Nội dung phải escape |
| Bảng trạng thái run (Runs) | `runs-table` | Trang Runs/Logs | status theo ngày |
| Badge trạng thái run | `run-status-{date}-{categoryId}` | Trang Runs | collected/sent/failed/partial |
| Trang xác nhận unsubscribe | `unsubscribe-result` | Trang public unsubscribe | thông báo generic |

# Phân Tầng Test Case (Test Pyramid)

> Nguồn: `test.md` (i-20260706231719-ban-tin-hang-ngay). Mục tiêu: đặt mỗi assertion ở tầng rẻ nhất kiểm được nó. Không lặp 1 assertion ở nhiều tầng.

# Tổng Quan Kim Tự Tháp

| Tầng | Số case | Tỉ lệ | Ghi chú hình dạng |
|------|---------|-------|-------------------|
| Unit | 20 | ~54% | (đáy — nhiều nhất) logic thuần: chuẩn hóa URL/dedup, ranking, window 24h, validation, config, sanitize, SSRF-check, DTO, idempotency-key |
| Functional | 13 | ~35% | (giữa) API/handler với DB thật + hệ ngoài mock: auth, CRUD, collect/send pipeline, integration failure |
| E2E | 4 | ~11% | (đỉnh — ít nhất) chỉ luồng người dùng quan trọng qua UI (data-testid) |

> **Hình dạng: pyramid khỏe mạnh** (Unit > Functional > E2E). Không có "ice-cream cone". Phần lớn logic nghiệp vụ (dedup/ranking/window/validation) đẩy xuống Unit; E2E chỉ giữ happy-path admin + bảo mật truy cập + unsubscribe.

# 1. Unit Test Cases

> Logic thuần, không I/O. Adapter registry/env truyền vào dạng tham số để test thuần.

| ID | Hàm/Đơn vị (SUT) | Input | Expected output | Kỹ thuật | Map test.md |
|----|------------------|-------|-----------------|----------|-------------|
| UT-01 | `normalizeUrl()` | `https://a.com/x?utm_source=1`, `https://a.com/x/` | Cùng 1 khóa chuẩn hóa (bỏ utm, trailing slash) | EP | TC-14 |
| UT-02 | `buildFingerprint()` | 2 tin cùng tiêu đề khác nguồn | Cùng fingerprint | Error Guessing | TC-14 |
| UT-03 | `dedup()` trong-run | list có 2 item cùng normalizedUrl | Loại còn 1 | EP | TC-14 |
| UT-04 | `isInWindow24h()` | publishedAt = run-24h+1s / -1s (UTC) | true / false | BVA | TC-... (Edge 24h) |
| UT-05 | `isInWindow24h()` lệch TZ | giờ địa phương nguồn khác | Chuẩn hóa UTC rồi so, đúng | Error Guessing | Edge lệch múi giờ |
| UT-06 | `normalizeEngagement()` | upvote Reddit vs like TikTok (min-max/platform) | Điểm [0..1] theo platform | EP | TCD-08 |
| UT-07 | `computeFinalScore()` | rel=0.8, eng=0.5, w_rel=0.6/w_eng=0.4 | 0.68 | Decision Table | TCD-08 |
| UT-08 | `selectTopN()` | 15 tin đã chấm điểm, N=10 | 10 tin theo finalScore giảm dần | BVA | TC-10,TC-22 |
| UT-09 | `selectTopN()` thiếu | 4 tin, N=10 | Trả 4, cờ "thiếu" | BVA | TC-22 |
| UT-10 | `emailSchema` (zod) | `a@b.com` / `abc@` / `a b@x` / `{$ne:null}` | pass / fail / fail / fail | EP + Negative | TC-08,TC-09, NoSQLi |
| UT-11 | `topNSchema` (zod) | 0 / 1 / 50 / 51 / "x" | fail/pass/pass/fail/fail | BVA | TC-07 |
| UT-12 | `categoryNameSchema` | "" / "   " / "AI" | fail/fail/pass (trim) | BVA | TC-04 |
| UT-13 | `keywordsSchema` | [] / 1 / 20 / 21; len 101 | fail/pass/pass/fail; fail | BVA | TC-06 |
| UT-14 | `scopeSchema` | VN / WORLD / [VN,WORLD] / "XX" | pass×3 / fail | EP | TCD-02 |
| UT-15 | `validateConfig()` | retention=7,dedup=14 / retention=30,dedup=14 | throw / ok | Decision Table | TC-... (retention≥dedup) |
| UT-16 | `buildActiveAdapters(env)` | đủ key / chỉ claude / không key / chỉ token / key+token | [3]/[claude]/[]/[claude]/[claude ưu tiên token] | Decision Table | TC-11,TC-12,TC-D7,TC-D8 |
| UT-17 | `sanitizeContent()` | `<script>`,`<img onerror>` trong title | Bị loại/escape, text an toàn | Error Guessing | XSS |
| UT-18 | `isPublicUrl()` (SSRF guard) | `http://169.254.169.254`, `http://localhost`, `https://x.com` | false/false/true | Error Guessing | SSRF |
| UT-19 | `toCategoryDTO()`/`toSubscriberDTO()` | doc có passwordHash/unsubscribeToken | DTO không chứa field nhạy cảm | Risk-Based | API3/Data Leakage |
| UT-20 | `idempotencyKey()` | (date,catId,step) | Khóa ổn định, đồng nhất khi lặp | State Transition | TC-13,TC-16 |

# 2. Functional Test Cases

> Qua API/handler + DB thật (hoặc in-memory Mongo). Hệ ngoài (Perplexity/Firecrawl/Apify/SMTP/QStash) mock/stub.

| ID | Tính năng / Endpoint | Tiền điều kiện | Bước | Dữ liệu vào | Kết quả mong đợi | Mock/Stub | Kỹ thuật | Map test.md |
|----|----------------------|----------------|------|-------------|------------------|-----------|----------|-------------|
| FT-01 | Auth login | admin trong DB | POST login đúng, rồi sai×5 | đúng / sai×5 | 200+session / khóa tạm, thông báo generic | — | State Transition | TC-02,TC-03 |
| FT-02 | Guard `/api/admin/*` | không session | Gọi GET/POST/PATCH/DELETE | không cookie | Tất cả 401/403 | — | Risk-Based | TC-01, BAC |
| FT-03 | Create Category | đã đăng nhập | POST tạo danh mục | thiếu name / trùng / topN=51 / hợp lệ | 400×3 / 201 | — | Decision Table | TC-04,05,07 |
| FT-04 | Add Subscriber | có danh mục | POST thêm email | sai định dạng / trùng / hợp lệ | 400/409/201, không tạo bản ghi 2 | — | EP | TC-08,09 |
| FT-05 | NoSQLi guard | đã đăng nhập | POST email=`{"$ne":null}` | payload object | 400 (zod chặn), không query | — | Negative | NoSQLi |
| FT-06 | Response projection | có dữ liệu | GET danh mục/subscriber | — | Không chứa passwordHash/token/secret | — | Risk-Based | API3 |
| FT-07 | Collect đủ adapter | danh mục enabled | Chạy worker collect | 3 adapter trả tin | ≤topN tin/danh mục, không trùng, run=collected | Perplexity/Firecrawl/Apify stub | Decision Table | TC-10 |
| FT-08 | Collect thiếu key | chỉ ANTHROPIC_API_KEY | Chạy collect | env thiếu 2 key | Thu thập được, engagement=0, tools=[claude] | stub Claude | Decision Table | TC-11,TS-04 |
| FT-09 | Collect no-adapter | không env key | Chạy collect | env trống | run=failed, alert gửi, 0 tin | stub mail alert | Decision Table | TC-12,TS-05 |
| FT-10 | Collect idempotent | đã collected hôm nay | Chạy collect lần 2 | same date | No-op, không tạo tin trùng | stub adapters | State Transition | TC-13, Concurrency |
| FT-11 | Dedup xuyên ngày | DB có tin (window) URL x | Collect thấy x?utm=2 | trong dedup window | Bị loại, không thêm | stub adapters | Error Guessing | TC-14,TS-06 |
| FT-12 | Send happy + idempotent + rỗng | run collected + subscriber | Chạy send, rồi lần 2; case run=failed | — | Lần 1 sent + delivery_logs; lần 2 no-op; failed→không gửi | stub SMTP | State Transition | TC-15,16,17 |
| FT-13 | Send partial + no-subscriber + unsubscribe + cron secret + integration-fail | mix | Chạy send 1 email lỗi; danh mục ko subscriber; GET unsubscribe token đúng/sai; worker sai secret; Perplexity timeout / Mongo down / Apify sai schema / SMTP auth fail / QStash absent | — | partial+retry; skip gửi; active=false/generic; 401; fallback/không crash/loại item lỗi | stub SMTP/QStash + fault-inject | Error Guessing | TC-18,19,20,21 + Integration/API |

# 3. E2E Test Cases

> Luồng người dùng đầu-cuối qua UI (data-testid). KHÔNG sinh code automation — chỉ khai báo bước + locator.

| ID | Luồng | Tiền điều kiện | Bước (qua UI) | Dữ liệu vào | Kết quả mong đợi | data-testid dùng | Kỹ thuật | Map test.md |
|----|-------|----------------|---------------|-------------|------------------|------------------|----------|-------------|
| E2E-01 | Đăng nhập + tạo danh mục + thêm email (happy path chính) | có admin | Đăng nhập → Thêm danh mục → nhập name/keywords/scope/topN → lưu → mở panel email → thêm 2 email | admin đúng; "AI"; 2 email hợp lệ | Vào dashboard; danh mục xuất hiện `category-row`; 2 email trong panel | `login-email-input`,`login-password-input`,`login-submit-btn`,`category-add-btn`,`category-name-input`,`category-keywords-input`,`category-scope-select`,`category-topn-input`,`category-save-btn`,`category-row-{id}`,`subscriber-email-input`,`subscriber-add-btn`,`subscriber-row-{id}` | Risk-Based (happy path) | TS-01,TC-02 |
| E2E-02 | Chặn truy cập trái phép (bảo mật) | chưa đăng nhập | Mở URL admin trực tiếp | — | Bị chuyển về trang đăng nhập, không thấy dữ liệu | `login-submit-btn` (xuất hiện), không có `runs-table` | Risk-Based (BAC) | TC-01,TS-08 |
| E2E-03 | Xóa danh mục có xác nhận + lỗi validate hiển thị | đã đăng nhập, có danh mục | Sửa danh mục bỏ name → lưu (thấy lỗi); thêm email sai (thấy lỗi); xóa danh mục → xác nhận | name rỗng; email "abc@" | `category-form-error` hiện; `subscriber-error-msg` hiện; sau xác nhận hàng biến mất | `category-edit-btn-{id}`,`category-name-input`,`category-save-btn`,`category-form-error`,`subscriber-email-input`,`subscriber-add-btn`,`subscriber-error-msg`,`category-delete-btn-{id}`,`confirm-delete-btn` | Error Guessing | TC-04,08 |
| E2E-04 | Run-now + preview escape + unsubscribe | có danh mục+email, có tin (seed/stub) | Bấm run-now → mở preview (kiểm nội dung có `<script>` bị escape) → mở link unsubscribe | tin chứa HTML độc | Preview hiển thị text an toàn (không thực thi); trang unsubscribe xác nhận generic | `run-now-btn-{categoryId}`,`digest-preview-btn-{categoryId}`,`digest-preview-content`,`unsubscribe-result` | Risk-Based (XSS) | TC-19, XSS |

# Ma Trận Truy Vết (Traceability)

| Yêu cầu / Business Rule (FRD) | Unit | Functional | E2E | Ghi chú |
|-------------------------------|------|------------|-----|---------|
| CRUD danh mục (name unique, ≥1 keyword, topN, scope) | UT-08..14 | FT-03 | E2E-01,03 | Đầy đủ |
| CRUD email người nhận (định dạng, chống trùng) | UT-10 | FT-04 | E2E-01,03 | Đầy đủ |
| Thu thập Top N/danh mục (24h, adapter theo env) | UT-04,05,08,09,16 | FT-07,08,09 | — | Logic ở Unit; luồng ở Functional |
| Xếp hạng nổi bật (AI relevance + engagement) | UT-06,07 | FT-07 | — | Công thức chốt ở /tn-code |
| Chống trùng (dedup window, URL/fingerprint) | UT-01,02,03 | FT-11 | — | Đầy đủ |
| Idempotency (cron retry, không ghi/gửi trùng) | UT-20 | FT-10,FT-12 | — | Đầy đủ |
| Không gửi email rỗng (collect fail → send) | — | FT-09,FT-12 | — | Rule vận hành ở Functional |
| Gửi digest theo danh mục + trạng thái gửi | — | FT-12,FT-13 | E2E-04 (preview) | — |
| Unsubscribe (token, set active=false) | UT-19 (DTO) | FT-13 | E2E-04 | — |
| Cấu hình env (không hardcode, retention≥dedup) | UT-15,16 | FT-08,09 | — | — |
| Auth admin bắt buộc (BAC) | — | FT-01,FT-02 | E2E-02 | CRITICAL — phủ Functional+E2E |
| Bảo vệ cron/worker (secret) | — | FT-13 | — | — |
| Chống NoSQLi / XSS / SSRF | UT-10,17,18 | FT-05 | E2E-04 (XSS) | — |
| Không rò rỉ field nhạy cảm | UT-19 | FT-06 | — | — |
| Tích hợp lỗi (timeout/retry/fallback) | — | FT-13 | — | — |

# Khoảng Trống & Khuyến Nghị Đặt Tầng

- `[HIGH]` **Công thức chuẩn hóa engagement** (UT-06/UT-07) hiện test theo giá trị mẫu; khi /tn-code chốt phương pháp (min-max/z-score/percentile) phải cập nhật input/expected của UT-06,07 cho khớp.
- `[MEDIUM]` **Test tải/quy mô** (N danh mục lớn → timeout/quota, throttle QStash) **chưa có tầng nào phủ** — thuộc Non-Functional/Performance, đề xuất bổ sung test tải riêng khi scale (ngoài pyramid chức năng).
- `[MEDIUM]` **Định dạng/layout email** chưa phủ (phụ thuộc template chốt sau) — khi có template, thêm 1 Functional test render + 1 kiểm snapshot nội dung escape.
- `[MEDIUM]` **CSRF** đặt ở Functional (kiểm Origin/token) — hiện gộp trong FT-02/FT-13; khi chốt cơ chế ở /tn-code, tách 1 case riêng cho rõ.
- `[LOW]` **Rate-limit (429)** gộp trong FT-13; có thể tách case riêng nếu cần đo ngưỡng cụ thể.
- **Nguyên tắc đặt tầng đã áp dụng:** mọi logic thuần (dedup/ranking/window/validation/sanitize/SSRF/DTO) ở **Unit**; luồng qua API + DB + hệ ngoài mock ở **Functional**; chỉ happy-path admin + chặn truy cập + preview-escape + unsubscribe ở **E2E** (đắt/giòn) → giữ pyramid khỏe mạnh.
