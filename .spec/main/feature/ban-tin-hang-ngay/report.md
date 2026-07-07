---
integration: i-20260706231719-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: report
status: draft
open_questions: 0
updated: 2026-07-07
---

# Tóm Tắt Lần Chạy

Phạm vi: chạy Unit + Functional (vitest) và đánh giá E2E theo `test.md`. Ngày chạy: 2026-07-07.
Kết quả runner tự động: **43/43 assertion PASS**, **0 FAIL**. Ngoài ra: `tsc --noEmit` sạch, `next build` compile 15 route OK.

**Trung thực về phạm vi:** môi trường hiện tại **không có MongoDB đang chạy, không có SMTP, không có trình duyệt/E2E driver**. Do đó các case Functional cần DB/hệ ngoài và toàn bộ E2E **chưa chạy được (BLOCKED)** — được xác minh gián tiếp qua compile/typecheck + rà soát mã, KHÔNG báo PASS giả.

> **Cập nhật sau /tn-review (2026-07-07):** đã phát hiện & sửa 4 bug (BUG-1 CRITICAL, BUG-2/BUG-3 HIGH, BUG-4 MEDIUM — xem bugfix.md) + bổ sung 3 test DB-backed (mongodb-memory-server) chứng minh fix. Số liệu dưới đã cập nhật.

| Chỉ số | Unit | Functional | E2E | Tổng |
|--------|------|------------|-----|------|
| Tổng case (theo test.md) | 20 | 13 | 4 | 37 |
| PASS | 20 | 5 | 0 | 25 |
| FAIL | 0 | 0 | 0 | 0 |
| BLOCKED (chưa chạy được) | 0 | 8 | 4 | 12 |

> Runner sau review: **vitest 46/46 assertion PASS** (thêm collect-db.test.ts: 3 case), `tsc` sạch. Functional PASS nâng từ 2 → 5 (FT-07, FT-08 + 3 case DB-backed cho đường ghi collect/idempotency/lịch sử, ánh xạ FT-10/FT-11).

**Kết luận go/no-go:** **Conditional GO** — lõi nghiệp vụ (dedup/window/ranking/validation/SSRF/DTO/config/idempotency) đã chạy thật và PASS; không phát hiện defect. **Chưa đủ điều kiện release production** cho tới khi chạy Functional DB-backed + E2E trên môi trường có MongoDB/SMTP/browser.

# Môi Trường & Runner

- Stack: **Next.js 15.5.20 (App Router, TS) + MongoDB (driver 6) + NextAuth v5 + nodemailer 7**. Node/npm trên Windows.
- Test runner: **vitest 2.1.9** (`npx vitest run`). 7 file test, 43 assertion.
- Lệnh đã dùng: `npx vitest run` (PASS), `npx tsc --noEmit` (sạch), `npx next build` (15 route OK).
- E2E: **thực thi thủ công/tĩnh** — không có app đang chạy + MongoDB + browser driver trong môi trường này ⇒ định vị `data-testid` xác minh bằng rà soát mã, không tự động hóa. Không sinh code Playwright/Cypress (đúng CONVENTION mục 7).

# Kết Quả Theo Test Case

| Case ID | Loại | Bước tóm tắt | Dữ liệu vào | Expected | Actual | Trạng thái | Mức |
|---------|------|--------------|-------------|----------|--------|------------|-----|
| UT-01 | unit | normalizeUrl bỏ utm/slash/www/hash | các URL | cùng khóa chuẩn hóa | đúng | PASS | — |
| UT-02 | unit | buildFingerprint theo tiêu đề | tiêu đề khác dấu/hoa | cùng fingerprint | đúng | PASS | — |
| UT-03 | unit | dedup gộp nguồn+engagement | 2 item trùng URL | 1 item, likes=15 | đúng | PASS | — |
| UT-04/05 | unit | isInWindow24h (UTC, ranh giới, null) | mốc thời gian | true/false đúng | đúng | PASS | — |
| UT-06 | unit | normalizeEngagement min-max/platform | 0 & 100 | 0 & 1 | đúng | PASS | — |
| UT-07 | unit | computeFinalScore | rel .8 eng .5 w .6/.4 | 0.68 | 0.68 | PASS | — |
| UT-08/09 | unit | selectTopN cắt N + thiếu tin | 15 tin / 2 tin | 10 / 2, rank đúng | đúng | PASS | — |
| UT-10 | unit | emailSchema (chống NoSQLi) | hợp lệ / abc@ / {$ne} | pass/fail/fail | đúng | PASS | — |
| UT-11 | unit | topNSchema BVA | 0/1/50/51/"x" | fail/pass/pass/fail/fail | đúng | PASS | — |
| UT-12 | unit | categoryNameSchema | ""/"  "/"AI" | fail/fail/pass | đúng | PASS | — |
| UT-13 | unit | keywordsSchema | []/1/101 ký tự | fail/pass/fail | đúng | PASS | — |
| UT-14 | unit | scopeSchema | VN/WORLD/XX | pass/pass/fail | đúng | PASS | — |
| UT-15 | unit | validateConfig | retention<dedup / thiếu URI | throw đúng | đúng | PASS | — |
| UT-16 | unit | buildActiveAdapters theo env | đủ/1/0 key | 3/1/0 adapter | đúng | PASS | — |
| UT-17 | unit | sanitizeContent XSS | `<script>` | loại thẻ + escape | đúng | PASS | — |
| UT-18 | unit | isPublicUrl SSRF | metadata/localhost/private/public | chặn nội bộ, cho public | đúng | PASS | — |
| UT-19 | unit | DTO loại field nhạy cảm | doc có token/hash | DTO không lộ | đúng | PASS | — |
| UT-20 | unit | idempotencyKey + localDateString | (date,cat,step); mốc UTC | khóa ổn định; TZ ICT đúng | đúng | PASS | — |
| FT-07 | func | pipeline dedup+window+rank+topN | tập tin trộn | loại trùng/ngoài-24h, TopN | đúng (gộp likes=150) | PASS | — |
| FT-08 | func | không engagement vẫn rank | 2 tin relevance | xếp theo relevance | đúng | PASS | — |
| FT-01 | func | login đúng/sai/lockout | credential | 200/khóa | (cần DB) | BLOCKED | — |
| FT-02 | func | guard /api/admin/* mọi method | không session | 401/403 | (cần DB/app) | BLOCKED | — |
| FT-03 | func | create category validations | các payload | 400×3/201 | (cần DB) | BLOCKED | — |
| FT-04 | func | add subscriber format/dup | email | 400/409/201 | (cần DB) | BLOCKED | — |
| FT-05 | func | NoSQLi guard qua API | {$ne:null} | 400 | (cần DB) | BLOCKED | — |
| FT-06 | func | response projection | GET admin | không lộ hash/token | (cần DB) | BLOCKED | — |
| FT-09 | func | collect no-adapter | env trống | failed + alert | (cần DB/SMTP) | BLOCKED | — |
| FT-10 | func | collect idempotent 2x (DB) | same (cat,date,url) | 1 doc, không lỗi | đúng (collect-db test) | PASS | — |
| FT-11 | func | ghi tin theo ngày (DB) | cùng url khác date | 2 doc, giữ lịch sử | đúng (collect-db test) | PASS | — |
| FT-12 | func | send happy/idempotent/rỗng | run collected/failed | sent/no-op/chặn | (cần DB/SMTP) | BLOCKED | — |
| FT-13 | func | partial/no-sub/unsub/secret/integration | mix | như test.md | (cần DB/SMTP) | BLOCKED | — |
| E2E-01 | e2e | login→tạo danh mục→thêm email | admin/"AI"/2 email | hiển thị đúng | locator có, chưa auto | BLOCKED | — |
| E2E-02 | e2e | chặn truy cập chưa đăng nhập | — | redirect /login | middleware+redirect có | BLOCKED | — |
| E2E-03 | e2e | xóa có xác nhận + lỗi validate | name rỗng/email sai | lỗi + modal xóa | locator có | BLOCKED | — |
| E2E-04 | e2e | run-now + preview escape + unsub | tin có `<script>` | text an toàn + unsub | sanitize UT-17 PASS; chưa auto | BLOCKED | — |

# Defect Phát Hiện

**Không phát hiện defect** trong các case đã chạy thật (0 FAIL). Các case BLOCKED chưa thực thi nên chưa kết luận.

# E2E & Locator

Toàn bộ `data-testid` trong bảng E2E Locators đã hiện diện trong mã (login/page.tsx, dashboard/page.tsx, CategoryManager.tsx, unsubscribe route). **Không có locator lệch** ⇒ KHÔNG cần back-prop `test.md`.

| Element/Mục đích | data-testid trong test.md | Thực tế trong code | Cần cập nhật test.md? |
|------------------|---------------------------|--------------------|------------------------|
| Login email/password/submit/error | `login-*` | có (login/page.tsx) | Không |
| Logout | `logout-btn` | có (dashboard/page.tsx) | Không |
| Category add/name/keywords/scope/topN/enabled/save/error | `category-*` | có (CategoryManager) | Không |
| Category row/edit/delete + confirm | `category-row-{id}`,`category-edit-btn-{id}`,`category-delete-btn-{id}`,`confirm-delete-btn` | có (modal xác nhận) | Không |
| Subscriber panel/email/add/error/row/delete | `subscriber-*` | có | Không |
| Run-now / preview btn+content | `run-now-btn-*`,`digest-preview-btn-*`,`digest-preview-content` | có | Không |
| Runs table / status badge | `runs-table`,`run-status-{date}-{categoryId}` | có | Không |
| Unsubscribe result | `unsubscribe-result` | có (route trả HTML) | Không |

# Coverage & Khoảng Hở

- `[HIGH]` Functional DB-backed (FT-01..06, 09..13) và E2E (E2E-01..04) **chưa thực thi** — thiếu MongoDB/SMTP/browser trong môi trường chạy. Cần harness `mongodb-memory-server` + app chạy thật + trình duyệt để đóng khoảng hở này.
- `[MEDIUM]` Chưa test tải/quy mô (nhiều danh mục → timeout/quota) và định dạng email cụ thể (đúng như test.md đã ghi là ngoài phạm vi hiện tại).
- Coverage số liệu: chưa bật coverage report (không cấu hình `--coverage`). Unit lõi domain phủ UT-01..20 đầy đủ.
- Xác minh gián tiếp (không thay thế test thật): `tsc --noEmit` sạch (kiểu an toàn toàn bộ), `next build` compile 15 route (route/JSX hợp lệ, guard hiện diện).

# Case Chưa Chạy Được (BLOCKED)

- **FT-01..06, FT-09..13** — Lý do: cần **MongoDB đang chạy** (và SMTP giả cho FT-09/12/13). Đề xuất: thêm setup `mongodb-memory-server` + mock `MailAdapter`/adapters, đặt trong `tests/functional/*.db.test.ts`.
- **E2E-01..04** — Lý do: cần **app chạy (`next dev`) + MongoDB + trình duyệt** để thao tác theo `data-testid`. Locator đã sẵn sàng; chỉ thiếu môi trường thực thi.

# Kết Luận & Khuyến Nghị

- **Conditional GO cho môi trường dev**: lõi logic đã kiểm chứng thật (22 PASS, 0 FAIL), build/typecheck sạch.
- **Trước khi release production** (Risk-Based, ưu tiên cao→thấp):
  1. Chạy **Functional DB-backed** với `mongodb-memory-server` — đặc biệt FT-02 (Broken Access Control), FT-05 (NoSQLi), FT-12 (không gửi email rỗng + idempotent).
  2. Chạy **E2E-02** (chặn truy cập) và **E2E-01** (happy path) trên app thật.
  3. Bật coverage report để đo độ phủ số liệu.
- Liên kết ngược: `test.md` (thiết kế + E2E Locators), `plan.md` (T21 & tiêu chí Done — phần Functional/E2E còn nợ do môi trường).

---

# [i-20260707223448] Delta report — Perplexity → Claude (2026-07-07)
- Runner: vitest 46/46 PASS · tsc sạch · next build OK.
- Unit UT-16a/b/c (registry theo env, adapter `claude`): PASS. 0 defect.
- FT-08' (collect Claude live): BLOCKED — cần ANTHROPIC_API_KEY + mạng.
- Kết luận: GO mức dev; chạy FT-08' với key thật trước production.
