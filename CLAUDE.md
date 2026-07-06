<!-- tieu-nhi:start -->
## Pipeline tài liệu-trước (documentation-first)

Dự án theo quy trình **tài liệu là tài sản chính, code là bước cuối**. Mọi tài liệu nằm trong
`.spec/`. Mỗi yêu cầu/thay đổi = 1 "integration" `<id>` = `i-<yyyyMMddHHmmss>-<slug>` (delta, bất biến sau khi approved);
`.spec/main/` là trạng thái hợp nhất hiện hành — **copy `.spec/main/` là clone được tri thức hệ thống**.

**Luật sắt:**
- Mỗi tính năng phải có đủ: `frd.md` · `tech.md` · `security.md` · `test.md` · `plan.md` · `report.md` · `live-spec.md`.
- **KHÔNG code khi còn open question** — `/tn-code` có gate cứng, chặn nếu bất kỳ doc nào chưa `approved` hoặc còn `open_questions > 0`.
- Quy ước đầy đủ (cấu trúc, frontmatter, gate, cascade, live-spec, locators, registry) ở `.spec/integration/CONVENTION.md` — mọi lệnh phải đọc trước khi chạy.

**Pipeline (lệnh từng bước, prefix `tn-`):**

| Bước | Lệnh | Skill | Đầu ra |
|------|------|-------|--------|
| 0 (brownfield) | `/tn-khoi-tao` | `khoi-tao-tai-lieu` | `.spec/main/` as-built + baseline i-000 |
| 1 | `/tn-yeu-cau` | `phan-tich-nghiep-vu` | `frd.md` (hỏi làm rõ trước khi chốt) |
| 2 | `/tn-thiet-ke` | `thiet-ke-he-thong` | `tech.md` → `sad.md` |
| 3 | `/tn-bao-mat` | `bao-mat-he-thong` | `security.md` |
| 4 | `/tn-kiem-thu` | `kiem-thu-phan-mem` | `test.md` (test design: condition/scenario/case + E2E Locators, mô tả bằng lời) |
| 4b | `/tn-sinh-test` | `sinh-test-cases` | phân tầng **Unit/Functional/E2E** + ma trận truy vết (append vào `test.md`) |
| 5 | `/tn-ke-hoach` | (tổng hợp) | `plan.md` (task + phụ thuộc + tiêu chí Done) |
| 6 | `/tn-code` | (hiện thực) | code + back-prop locator |
| 7 | `/tn-bao-cao` | `chay-kiem-thu` | `report.md` (chạy thật, expected vs actual) |
| 8 | `/tn-review` | `review-code` | review; bug → `bugfix.md` + rule (mục dưới) → sửa sau |

Test case mô tả **bằng lời** (Bước/Dữ liệu vào/Kết quả mong đợi); e2e dùng `data-testid`, **không sinh code Playwright/Cypress**. Bước 4 thiết kế test (condition/scenario/case + Locators); bước 4b phân rã thành **3 tầng test pyramid** (Unit nhiều → Functional vừa → E2E ít) kèm ma trận truy vết về FRD (chỉ chạy khi `test.md` đã `approved`).

`<id>` = ID integration dạng `i-<yyyyMMddHHmmss>-<slug>` (timestamp tới giây ⇒ duy nhất kể cả khi làm song song nhiều branch); chi tiết ở `.spec/integration/CONVENTION.md` mục 8.

## Rules / Bài học kinh nghiệm

> `/tn-review` append vào đây mỗi khi phát hiện bug — 1 dòng rule rút kinh nghiệm để lần sau không lặp lại (kèm `(<id>)`).

- Khi upsert Mongo: KHÔNG để một field xuất hiện ở cả `$set` (kể cả qua spread `...doc`) lẫn `$setOnInsert` — MongoDB ném "conflict"; tách `createdAt` ra chỉ đặt ở `$setOnInsert` (i-20260706231719-ban-tin-hang-ngay).
- Khóa duy nhất cho dữ liệu có chiều thời gian (news theo ngày) phải gồm `date`; index `(categoryId, normalizedUrl)` thiếu `date` gây ghi đè lịch sử khi tin tái xuất sau dedup-window nhưng còn trong retention (i-20260706231719-ban-tin-hang-ngay).
- Auth phải có rate-limit/lockout login ngay từ bước code (đừng chỉ dựa bcrypt + generic error); tick checklist bảo mật trước khi expose (i-20260706231719-ban-tin-hang-ngay).
- Fanout tuần tự trong `after()` bị chặn bởi `maxDuration`; nhiều danh mục phải dùng queue (QStash) hoặc nâng maxDuration + giám sát thời lượng (i-20260706231719-ban-tin-hang-ngay).
- Không coi tính năng là "done" khi Functional DB-backed còn BLOCKED — nhiều bug ghi DB (conflict upsert, index) chỉ lộ khi chạy thật với mongodb-memory-server (i-20260706231719-ban-tin-hang-ngay).
<!-- tieu-nhi:end -->
