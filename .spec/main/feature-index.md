# Feature Index — Danh mục tính năng hệ thống

> Trạng thái hợp nhất các tính năng hiện hành. Mỗi dòng gắn slug + integration nguồn.

| Slug | Tính năng | Trạng thái frd | Integration nguồn | Ghi chú |
|------|-----------|----------------|-------------------|---------|
| ban-tin-hang-ngay | Bản tin hàng ngày (Daily News Digest): thu thập Top N tin nổi bật 24h theo danh mục (Claude web search/Apify/Firecrawl), lưu MongoDB, gửi email theo lịch | approved | i-20260706231719-ban-tin-hang-ngay; i-20260707223448 (Perplexity→Claude); i-20260708000200 (run-now force+email) | Next.js + Vercel; admin auth; config qua env; 6:00 thu thập → 6:30 gửi; "Chạy ngay" = force + gửi email luôn |
