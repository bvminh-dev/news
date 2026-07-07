---
integration: i-20260707223448-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: security
status: approved
open_questions: 0
updated: 2026-07-07
---

# Asset Inventory
| Tài sản | Loại | Độ nhạy cảm | Nơi lưu | Ai truy cập |
|---------|------|-------------|---------|-------------|
| `ANTHROPIC_API_KEY` | Secret (thay `PERPLEXITY_API_KEY`) | CAO (trả phí; web search tốn phí) | ENV | Runtime (ClaudeAdapter) |
| `ANTHROPIC_AUTH_TOKEN` | Secret — OAuth token Claude Code (`sk-ant-oat`) | CAO (mạo danh phiên Claude Code; ngắn hạn) | ENV | Runtime (ClaudeAdapter, ưu tiên hơn key) |
| `CLAUDE_MODEL` | Cấu hình | THẤP | ENV | Runtime |

# Threat Model (STRIDE)
| STRIDE | Threat cụ thể | Tác động | Mitigation | Mức |
|--------|---------------|----------|------------|-----|
| Info Disclosure | Lộ `ANTHROPIC_API_KEY` qua log/error/response | Mất tiền, lạm dụng | Chỉ ENV; không log; error generic; `.env*` gitignore | `[CRITICAL]` |
| DoS/Cost | Kích hoạt collect để đốt web search (phí theo lần) | Chi phí | Guard cron/worker (đã có) + `max_uses=5`/danh mục + giám sát | `[HIGH]` |
| Tampering | Nội dung web trả về chèn HTML độc | XSS ở email/preview | `sanitizeContent` áp cho title/summary từ Claude (đã có) | `[MEDIUM]` |
| Elevation/Exec | Prompt injection từ nội dung web → CLI lạm dụng tool (ghi file/chạy lệnh) | Chiếm host | `--permission-mode plan` (chỉ-đọc, chặn ghi/exec); prompt untrusted qua **stdin** không qua arg/shell | `[HIGH]` |
| Elevation/Exec | Chèn lệnh qua tham số spawn | RCE | Args cố định/không nội suy dữ liệu người dùng; `shell:true` CHỈ trên win32 (bin claude.cmd), mọi arg là literal | `[MEDIUM]` |
| Info Disclosure | CLI "mượn" tài khoản máy host (sai tính tiền/rò session) | Lẫn credential | Xoá ENV auth kế thừa + `CLAUDE_CONFIG_DIR` tạm riêng mỗi lần chạy | `[MEDIUM]` |

# Attack Surface
Bề mặt mới = **spawn tiến trình con `claude`** trên host. Web search do Claude/Anthropic thực thi (ta không tự fetch URL tùy ý ⇒ không thêm SSRF phía ta). Rủi ro chính chuyển sang: (1) prompt injection từ nội dung web khiến CLI lạm dụng tool — chặn bằng `--permission-mode plan` (chỉ-đọc); (2) truyền dữ liệu untrusted an toàn (stdin, không arg/shell); (3) cô lập credential/tài khoản (ENV riêng + config dir tạm). Phụ thuộc binary bên thứ ba (`@anthropic-ai/claude-code`) ⇒ cân nhắc chuỗi cung ứng (ghim/nâng phiên bản có kiểm soát).

# Authentication Review
Không đổi. Claude API key là secret máy-máy (SDK gửi qua header), tách biệt session admin.

# SSO Review
Không áp dụng.

# Session Review
Không đổi.

# Authorization Review
Không đổi.

# Permission Scope Review
Không đổi (adapter chỉ đọc/gọi API ngoài, không chạm quyền người dùng).

# Multi Tenant Security Review
Không áp dụng.

# API Security Review
Không thêm endpoint. Guard `/api/cron|worker/*` (đã có) bảo vệ việc kích hoạt collect (nay tốn phí web search) — càng quan trọng.

# Injection Risks
- `[HIGH]` **Prompt injection** từ nội dung web (CLI tự đọc) → giảm thiểu bằng `--permission-mode plan` (không cho ghi/exec) + prompt qua stdin. Không back-feed output vào lệnh khác.
- `[MEDIUM]` **Command injection**: args spawn cố định, KHÔNG nội suy dữ liệu người dùng vào arg; prompt qua stdin. `shell:true` chỉ trên win32 với arg literal ⇒ không mở shell cho dữ liệu untrusted.
- `[MEDIUM]` Output JSON từ CLI parse bằng quét ngoặc cân bằng + `JSON.parse`; không đưa vào Mongo query thô → không tạo NoSQLi. Item lỗi bị loại.

# XSS Risks
- `[MEDIUM]` title/summary từ web (qua Claude) → **sanitizeContent** (strip thẻ + escape) trước khi lưu/hiển thị/email. (Kế thừa kiểm soát; áp cho adapter mới.)

# CSRF Risks
Không đổi.

# File Upload Risks
Không áp dụng.

# Data Protection Review
Không đổi (không thêm PII; chỉ nội dung tin công khai).

# Encryption Review
In transit: Anthropic API qua HTTPS/TLS. Secret ở ENV (Vercel mã hóa).

# Secret Management Review
- `[CRITICAL]` `ANTHROPIC_API_KEY` **và** `ANTHROPIC_AUTH_TOKEN` chỉ ở ENV; không hardcode/commit/log/trả API. `.env.example` không chứa giá trị thật (chỉ tên biến + hướng dẫn). Không đưa vào `NEXT_PUBLIC_*`. Dùng ở server (adapter) — không lộ client.
- `[MEDIUM]` Credential truyền cho tiến trình con qua **ENV** (`CLAUDE_CODE_OAUTH_TOKEN` cho oat / `ANTHROPIC_API_KEY`+`--bare` cho api), **không qua arg** (tránh lộ qua `ps`/log). Không log credential; phân loại lỗi auth/quota bằng regex chứ không in giá trị.
- `[MEDIUM]` OAuth token (`sk-ant-oat`) **ngắn hạn/hết hạn, không tự refresh** — cần cập nhật thủ công; ưu tiên xoay/thu hồi khi nghi lộ. Nếu cấu hình cả token lẫn key, adapter ưu tiên token.
- `[MEDIUM]` Xoay key/token khi nghi lộ; giám sát chi phí Claude + web search theo ngày.

# Audit Review
- `[LOW]` Nên log số lần web search/danh mục (chi phí) — bổ sung observability.

# Security Event Catalog
| Sự kiện | Ghi log? | Cảnh báo? | Mức |
|---------|----------|-----------|-----|
| Claude adapter fail (refusal/5xx/quota/401 token hết hạn/429 token subscription) | Cần | Có (adapter-fail alert đã có) | `[MEDIUM]` |
| Chi phí/quota web search cao bất thường | Nên | Nên | `[MEDIUM]` |

# Monitoring Gaps
- `[MEDIUM]` Giám sát quota/chi phí Claude + web search theo ngày (kế thừa mục giám sát công cụ trả phí).

# Data Leakage Risks ⚠️
- `[CRITICAL]` Lộ `ANTHROPIC_API_KEY` trong error/log. Mitigation: error handler generic, không log secret (đã có).

# Privilege Escalation Risks ⚠️
Không đổi.

# Security Misconfiguration Risks
- `[LOW]` `CLAUDE_MODEL` sai → API 404; coi như lỗi cấu hình, alert. Validate env (fail-fast không bắt buộc adapter key).

# Incident Response Risks
- `[MEDIUM]` Thêm `ANTHROPIC_API_KEY` vào runbook xoay secret khẩn cấp.

# Zero Trust Assessment
| Nguyên tắc | Hiện trạng | Khoảng trống | Mức |
|------------|------------|--------------|-----|
| Least Privilege | Adapter chỉ dùng key gọi API | Key có quyền rộng theo tài khoản Anthropic | `[MEDIUM]` |

# Open Security Questions
> Không còn câu hỏi bảo mật chặn.
1. ✅ Secret Claude chỉ ENV (thay Perplexity key), không log.
2. 🟡 Giám sát chi phí web search — khuyến nghị, không chặn.

# Security Recommendations
- `[Ưu tiên 1]` `ANTHROPIC_API_KEY` chỉ ENV, không log/không trả API; `.gitignore` đã chặn `.env*`.
- `[Ưu tiên 2]` Guard cron/worker (đã có) — quan trọng hơn vì web search tốn phí; giám sát quota/chi phí.
- `[Ưu tiên 3]` Giữ `sanitizeContent` cho nội dung nguồn (áp cho ClaudeAdapter); cập nhật runbook xoay key.
