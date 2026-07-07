---
integration: i-20260707223448-ban-tin-hang-ngay
feature: ban-tin-hang-ngay
stage: plan
status: approved
open_questions: 0
updated: 2026-07-07
---

# Tổng Quan & Phạm Vi
Kế hoạch hiện thực delta thay Perplexity → Claude. Thay đổi nhỏ, gói gọn trong lớp adapter + config + env + test. **Code đã hiện thực trước** (theo yêu cầu trực tiếp); plan này ghi nhận task + tiêu chí Done để đối chiếu ở /tn-code và /tn-bao-cao.

# Danh Sách Task
| Task | Mô tả | Phụ thuộc | Tham chiếu | Tiêu chí Done |
|------|-------|-----------|------------|----------------|
| D1 | Env: bỏ `PERPLEXITY_API_KEY`; thêm `ANTHROPIC_API_KEY` + `CLAUDE_MODEL` (.env.example) | — | frd; ADR-02 | `.env.example` cập nhật; validateConfig không bắt buộc key adapter |
| D2 | Config: `tools.perplexityKey` → `tools.anthropicKey` + `tools.claudeModel` | D1 | tech §Container | `config.ts` build đúng; typecheck sạch |
| D3 | `ClaudeAdapter` (Messages API + web_search_20250305, parse JSON, refusal/pause_turn, sanitize) | D2 | tech ADR-01/03; security §XSS | UT parse/registry PASS; typecheck sạch |
| D4 | Registry: `ToolKeys` (anthropicKey/claudeModel) + build `ClaudeAdapter`; xóa `perplexity.ts` | D3 | tech ADR-04; test UT-16 | UT-16a/b/c PASS |
| D5 | Cài `@anthropic-ai/sdk` | — | tech | package.json + lock cập nhật |
| D6 | Cập nhật test UT-16 (perplexity→claude, khóa mới) | D4 | test | vitest PASS |
| D7 | Verify: typecheck + vitest + next build | D1..D6 | test | 46/46 PASS · tsc sạch · build OK |
| D8 | Auth token: thêm env `ANTHROPIC_AUTH_TOKEN`; config đọc `tools.anthropicAuthToken`; registry ưu tiên token; `.env.example` tài liệu 2 cách xác thực | D2,D4 | frd A1/A4; tech ADR-04/05; security §Secret | UT-16d/e PASS; tsc sạch |
| D9 | **Đổi cơ chế gọi**: adapter spawn `claude` CLI headless thay SDK Messages API (route oat→CLAUDE_CODE_OAUTH_TOKEN, api→ANTHROPIC_API_KEY+--bare; config dir cô lập; timeout+SIGKILL; parse ngoặc cân bằng) | D8 | tech ADR-06; security §Injection/Exec; frd EX-1..5 | tsc sạch; adapter-live PASS (token oat → tin thật) |

# Đồ Thị Phụ Thuộc
```
D5 (sdk) ┐
D1 → D2 → D3 → D4 → D6 → D7
```
Đường găng: `D1 → D2 → D3 → D4 → D6 → D7`.

# Tiêu Chí Done Tổng
- [ ] Env đổi khóa (Perplexity → Anthropic + CLAUDE_MODEL); không hardcode.
- [ ] ClaudeAdapter thay PerplexityAdapter; interface `NewsSourceAdapter` không đổi.
- [ ] Registry dựng adapter `claude` theo env; thiếu key ⇒ loại.
- [ ] Bảo mật: `ANTHROPIC_API_KEY` chỉ ENV, không log; sanitize nội dung nguồn.
- [ ] Test: UT-16 (registry theo env) PASS; typecheck + build OK.
- [ ] Không còn open question chặn.

# Rủi Ro & Giả Định
- `[HIGH]` Regression Registry (đổi khóa env) — mitigate bằng UT-16.
- `[MEDIUM]` Chi phí web search — max_uses=5 + giám sát.
- Giả định: người dùng có `ANTHROPIC_API_KEY`; model mặc định `claude-opus-4-8`.
- `[MEDIUM]` FT-08' (collect Claude thật) BLOCKED do thiếu key/mạng — chạy khi có key.

# Ghi Chú Cho /tn-code
Tất cả doc {frd,tech,security,test,plan} đã approved, open_questions=0 ⇒ đủ gate cứng. Code đã hiện thực; /tn-code chỉ cần đối chiếu + xác nhận.
