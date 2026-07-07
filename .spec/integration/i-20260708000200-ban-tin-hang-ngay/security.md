---
integration: i-20260708000200-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: security
status: approved
open_questions: 0
updated: 2026-07-08
---

# Asset Inventory
| Tài sản | Loại | Độ nhạy cảm | Ghi chú |
|---------|------|-------------|---------|
| delivery_logs (email người nhận) | PII/vận hành | TRUNG BÌNH | run-now `deleteMany` log hôm nay để gửi lại |
| Quota Claude + SMTP | Tài nguyên trả phí | CAO | run-now kích hoạt thu thập + gửi thật |

# Threat Model (STRIDE)
| STRIDE | Threat cụ thể | Tác động | Mitigation | Mức |
|--------|---------------|----------|------------|-----|
| **D** DoS/Cost | Bấm "Chạy ngay" liên tục → đốt quota Claude + spam email subscriber | Chi phí + phiền người nhận + có thể bị SMTP chặn | Rate-limit `10/60s` (đã có) + admin-only + CSRF `checkOrigin`; cân nhắc hạ ngưỡng cho run-now | `[MEDIUM]` |
| **T** Tampering | Đua 2 request cùng lúc → `$inc rank` chồng chéo | Rank lệch (không mất tin) | 1 admin + rate-limit (chấp nhận); tương lai: khóa theo (cat,date) | `[LOW]` |
| **R** Repudiation | Không phân biệt ai/khi nào chạy force | Khó truy vết | digest_runs có startedAt/finishedAt (đủ GĐ1) | `[LOW]` |

# Attack Surface
Không thêm endpoint/bề mặt mới. Run-now đã nằm sau auth admin + CSRF + rate-limit. Điểm cần chú ý: hành động này nay có **tác dụng phụ ra ngoài** (gửi email) → lạm dụng = spam; kiểm soát bằng rate-limit + auth.

# Authentication Review
Không đổi — `requireAdmin()` (session admin) bắt buộc.

# SSO / Session Review
Không áp dụng / không đổi.

# Authorization Review
Không đổi (chỉ admin).

# Permission Scope Review
Không đổi.

# Multi Tenant Security Review
Không áp dụng.

# API Security Review
- `POST /api/admin/run-now`: giữ `requireAdmin` + `checkOrigin` + `rateLimit(clientKey,'run-now',10,60_000)`. Nay còn gửi email ⇒ rate-limit là kiểm soát chính chống spam.

# Injection Risks
- Không đổi. `categoryId` validate zod; không nội suy vào query thô.

# XSS Risks
- Không đổi. Nội dung tin đã `sanitizeContent` khi thu thập; email render từ dữ liệu đã sanitize.

# CSRF Risks
- Không đổi — `checkOrigin` bảo vệ. Quan trọng hơn vì run-now nay gửi email (side-effect).

# File Upload Risks
Không áp dụng.

# Data Protection Review
- `[MEDIUM]` `resetDeliveries` xoá delivery_logs hôm nay của danh mục (chỉ metadata gửi, không xoá subscriber/PII gốc). Chủ ý để gửi lại; không rò rỉ dữ liệu.

# Encryption Review
Không đổi (SMTP TLS, secrets ENV).

# Secret Management Review
Không đổi.

# Audit Review
- `[LOW]` Nên log rõ "run-now (manual, force)" + số email gửi lại để truy vết lạm dụng.

# Security Event Catalog
| Sự kiện | Ghi log? | Cảnh báo? | Mức |
|---------|----------|-----------|-----|
| run-now gửi email lỗi một phần | Cần | Có (đã có send-fail alert) | `[MEDIUM]` |
| run-now bị rate-limit | Nên | — | `[LOW]` |

# Monitoring Gaps
- `[MEDIUM]` Giám sát tần suất run-now (chống đốt quota/spam).

# Data Leakage Risks ⚠️
- Không phát hiện mới.

# Privilege Escalation Risks ⚠️
- Không đổi.

# Security Misconfiguration Risks
- `[LOW]` Nếu hạ/tắt rate-limit → nguy cơ spam email. Giữ rate-limit run-now.

# Incident Response Risks
- `[LOW]` Nếu lỡ spam: vô hiệu subscriber/đổi mật khẩu SMTP; run-now là admin-only nên phạm vi hẹp.

# Zero Trust Assessment
| Nguyên tắc | Hiện trạng | Khoảng trống | Mức |
|------------|------------|--------------|-----|
| Least Privilege | run-now admin-only | — | `[LOW]` |

# Open Security Questions
> Không còn câu hỏi bảo mật chặn.
1. ✅ Gửi lại toàn bộ là chủ ý; kiểm soát spam bằng rate-limit + auth.

# Security Recommendations
- `[Ưu tiên 1]` Giữ rate-limit + CSRF + admin cho run-now (nay có side-effect gửi email).
- `[Ưu tiên 2]` Giám sát tần suất run-now + số email/ngày.
- `[Ưu tiên 3]` Log phân biệt manual/force cho audit.
