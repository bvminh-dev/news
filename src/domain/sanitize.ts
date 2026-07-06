/**
 * T9 — Chống XSS: loại bỏ HTML thô của nguồn tin. Ta KHÔNG render HTML nguồn,
 * chỉ dùng text an toàn. sanitizeContent strip toàn bộ thẻ + escape ký tự HTML.
 */

const TAG = /<[^>]*>/g;

export function stripTags(input: string): string {
  return input.replace(TAG, '');
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Làm sạch text từ nguồn: bỏ thẻ rồi escape (an toàn cho cả HTML email lẫn UI). */
export function sanitizeContent(input: string): string {
  return escapeHtml(stripTags(input)).trim();
}
