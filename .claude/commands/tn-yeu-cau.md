---
description: "Bước 1 (BA): phân tích yêu cầu, hỏi làm rõ, tạo <id> + frd.md, cascade lên main/"
argument-hint: "\"<mô tả yêu cầu/tính năng mới>\""
---

Bạn đang chạy **`/tn-yeu-cau`** — bước 1 (Phân tích nghiệp vụ) của pipeline tài liệu-trước.

Yêu cầu cần phân tích: **$ARGUMENTS**

## 0. Chuẩn bị
- Lấy ngày hiện tại: `date +%F` (Bash).
- **Lấy timestamp cho ID:** chạy `date +%Y%m%d%H%M%S` (Bash) → lưu là `<ts>` (dùng ghép ID ở mục 1). Timestamp tới giây đảm bảo ID **duy nhất kể cả khi phát triển song song trên nhiều branch**.
- **Bootstrap nếu thiếu:** tạo `.spec/main/feature/`, `.spec/integration/`. Nếu `.spec/integration/CONVENTION.md` chưa có → tạo với CHÍNH XÁC khối "NỘI DUNG CONVENTION.md" ở cuối lệnh; nếu `.spec/integration/registry.md` chưa có → tạo với khối "NỘI DUNG registry.md khởi tạo".
- Đọc `.spec/integration/CONVENTION.md` và tuân thủ.

## 1. Hiểu hệ thống hiện có (để hỏi đúng)
- Đọc `.spec/main/feature-index.md` và các `.spec/main/feature/<slug>/frd.md` liên quan để biết hệ thống ĐÃ có gì.
- Xác định đây là **tính năng mới** hay **thay đổi tính năng đã có**; chọn `<slug>` kebab-case không dấu phù hợp (tái dùng slug cũ nếu là thay đổi).
- **Tạo ID integration:** ghép `<id>` = `i-<ts>-<slug>` (vd `i-20260706143022-cai-dat-thu-vien`) — **KHÔNG dùng số thứ tự tăng dần** (dễ trùng khi merge nhiều branch). Tạo thư mục `.spec/integration/<id>/`.

## 2. Phân tích nghiệp vụ
- Dùng skill **`phan-tich-nghiep-vu`** (gọi qua công cụ Skill) cho `$ARGUMENTS`, có đối chiếu với tính năng hiện có (gap, conflict, impact chéo).
- Tổng hợp mục **"Các Câu Hỏi Cần Làm Rõ"**.

## 3. Hỏi lại người đưa yêu cầu (làm rõ)
- Dùng **AskUserQuestion** đặt các câu hỏi làm rõ quan trọng nhất, **dựa trên tính năng đã có** trong `feature-index.md`.
- Lặp đến khi đủ rõ. Câu nào người dùng chốt "giả định" → ghi rõ là giả định.
- Câu hỏi còn **chặn** (chưa giải quyết, không chấp nhận giả định) → đếm vào `open_questions`.

## 4. Ghi `frd.md` (delta)
- Ghi `.spec/integration/<id>/frd.md` theo **template 19 mục** của skill `phan-tich-nghiep-vu` (giữ đủ mục; mục trống ghi "Không phát hiện").
- Thêm frontmatter (CONVENTION mục 3): `stage: frd`. Đặt `status: approved, open_questions: 0` chỉ khi mọi câu hỏi chặn đã giải quyết; nếu còn → `status: needs-clarification` + `open_questions: <n>` và **dừng**, báo người dùng phần còn thiếu.

## 5. Cascade + ghi nhận
- Cascade (MERGE theo CONVENTION mục 5): `frd.md` → `.spec/main/feature/<slug>/frd.md`, và cập nhật/thêm dòng tính năng trong `.spec/main/feature-index.md`.
- Append `live-spec.md` (CONVENTION mục 6) ở cả `<id>/live-spec.md` và `.spec/main/live-spec.md`.
- Cập nhật `registry.md`: thêm/cập nhật dòng <id>, ô `frd` = `approved`/`needs-clarification`.
- Báo người dùng: <id>, slug, trạng thái, các open question (nếu có), và bước kế tiếp `/tn-thiet-ke <id>`.

---

### NỘI DUNG CONVENTION.md (ghi nguyên văn vào `.spec/integration/CONVENTION.md`)

```markdown
# CONVENTION — Pipeline tài liệu-trước (.spec)

> "Hợp đồng" dùng chung cho mọi lệnh `/tn-*`. Mọi lệnh PHẢI đọc file này trước khi chạy.
> KHÔNG sửa bằng tay trừ khi cố ý đổi quy ước cho toàn hệ thống.

## 1. Cấu trúc
.spec/
  main/                # trạng thái hợp nhất, hiện hành — copy .spec/main là clone tri thức hệ thống
    feature-index.md · sad.md · security.md · live-spec.md
    feature/<slug>/{frd,tech,security,test,report,live-spec}.md
  integration/         # mỗi thay đổi = 1 thư mục <id> = i-<yyyyMMddHHmmss>-<slug> (delta, BẤT BIẾN sau approved)
    registry.md · CONVENTION.md (file này)
    <id>/{frd,tech,security,test,plan,report,live-spec,bugfix}.md

## 2. Khái niệm
- <id> = ID một thay đổi/yêu cầu, dạng `i-<yyyyMMddHHmmss>-<slug>` (xem mục 8); tài liệu trong <id> là DELTA, không sửa sau khi approved.
- main/ = trạng thái hợp nhất hiện hành — đọc để biết "hệ thống đang có gì".
- cascade = sau khi ghi delta ở <id> thì MERGE lên main/ (mục 5).
- <slug> = kebab-case không dấu, ổn định. Một <id> gắn đúng 1 tính năng.

## 3. Frontmatter bắt buộc (frd/tech/security/test/plan/report)
---
integration: <id>
feature: <slug>
stage: frd          # frd|tech|security|test|plan|report
status: draft       # draft | needs-clarification | approved   (baseline cho i-000)
open_questions: 0   # số câu hỏi CHẶN còn lại
updated: YYYY-MM-DD
---

## 4. Gate
Thứ tự: [khoi-tao(0, brownfield)] -> yeu-cau(frd) -> thiet-ke(tech) -> bao-mat(security) -> kiem-thu(test) -> ke-hoach(plan) -> code -> bao-cao(report) -> review.
- Trước mỗi bước, đọc doc của bước NGAY TRƯỚC trong cùng <id>.
- Nếu upstream status != approved HOẶC open_questions > 0 -> DỪNG: in câu hỏi/việc thiếu, yêu cầu người dùng giải quyết hoặc chấp nhận giả định tường minh. KHÔNG tự đi tiếp.
- GATE CỨNG /tn-code: chặn nếu BẤT KỲ doc nào trong {frd,tech,security,test,plan} của <id> chưa approved hoặc open_questions > 0.

## 5. Cascade = MERGE (không ghi đè mù, không append mù)
1. File main đích chưa có -> tạo từ delta (giữ đúng section & thứ tự template).
2. Đã có -> MERGE: cập nhật section đổi; thêm mục mới; nội dung bị thay thế thì sửa và ghi chú "> [<id>] thay thế: ..." nếu quan trọng.
3. Giữ nguyên bộ section & thứ tự template skill tương ứng.
4. Mục/hàng quan trọng gắn dấu vết nguồn "(<id>)".
5. <id> BẤT BIẾN — chỉ sửa bản hợp nhất ở main.
Bản đồ:
- frd -> main/feature/<slug>/frd.md + cập nhật main/feature-index.md
- tech -> main/feature/<slug>/tech.md + main/sad.md
- security -> main/feature/<slug>/security.md + main/security.md
- test -> main/feature/<slug>/test.md
- report -> main/feature/<slug>/report.md
- live-spec -> main/feature/<slug>/live-spec.md + main/live-spec.md (rút gọn)
- plan -> KHÔNG cascade (chỉ ở <id>)

## 6. live-spec.md — nhật ký as-built (append xuống cuối)
## [YYYY-MM-DD] /tn-<lệnh> (<id>)
- Skill dùng: ...
- Việc đã làm: ...
- Quyết định/giả định: ...
- Lệch so với plan/spec: ...
- Kết quả test/locator/bug: ...

## 7. E2E Locators & test mô tả-bằng-lời
- test.md có section "E2E Locators": (Element/Mục đích -> data-testid đề xuất -> ghi chú).
- Ưu tiên data-testid ổn định; tránh selector theo text/vị trí.
- Test case mô tả bằng lời: Bước / Dữ liệu vào / Kết quả mong đợi. KHÔNG sinh code Playwright/Cypress.
- Back-prop: /tn-code tạo/đổi locator khác đề xuất -> cập nhật ngược test.md (+ cascade).

## 8. Registry & ID integration
Bảng registry.md: | ID | tính năng | loại | frd | tech | security | test | plan | code | report | review | ngày |
- ID integration = `i-<yyyyMMddHHmmss>-<slug>` (timestamp tới giây theo giờ máy: `date +%Y%m%d%H%M%S`, + slug tính năng), vd `i-20260706143022-cai-dat-thu-vien`. Sinh 1 lần lúc tạo integration, BẤT BIẾN.
- Timestamp tới giây ⇒ ID **duy nhất kể cả khi phát triển song song trên nhiều branch**; KHÔNG dùng số thứ tự tăng dần (tránh trùng số khi merge/cascade lên main).
- `i-000` = mã DÀNH RIÊNG cho baseline brownfield (nếu có), không có thư mục delta. ID cũ dạng `i-001…` tạo trước khi đổi quy ước vẫn giữ nguyên (bất biến).
- Mỗi lệnh cập nhật ô stage tương ứng (vd: draft/approved/done).

## 9. Mức rủi ro
CRITICAL | HIGH | MEDIUM | LOW (theo thang từng skill). Mục không phát hiện -> ghi "Không phát hiện" (giữ section).
```

### NỘI DUNG registry.md khởi tạo (nếu chưa có)

```markdown
# Registry — Sổ đăng ký thay đổi (.spec/integration)

| ID | Tính năng (slug) | Loại | frd | tech | security | test | plan | code | report | review | Ngày |
|-------|------------------|------|-----|------|----------|------|------|------|--------|--------|------|
```
