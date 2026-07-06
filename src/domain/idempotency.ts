/**
 * T11 — Khóa idempotency ổn định cho run/gửi (tech ADR-03).
 * Dùng làm khóa unique trên digest_runs (date,categoryId,step) và
 * delivery_logs (date,categoryId,email).
 */
export function idempotencyKey(date: string, categoryId: string, step: string): string {
  return `${date}::${categoryId}::${step}`;
}

/** Ngày YYYY-MM-DD theo múi giờ cấu hình, từ 1 mốc thời gian truyền vào (test được). */
export function localDateString(at: Date, timeZone: string): string {
  // en-CA cho định dạng YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}
