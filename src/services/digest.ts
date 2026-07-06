/**
 * T12 — Render nội dung email digest. Nội dung đã sanitize khi thu thập; ở đây chỉ
 * ghép text an toàn + link unsubscribe.
 */
import { NewsItemDoc, CategoryDoc } from '@/models';
import { escapeHtml } from '@/domain/sanitize';

export function renderDigestHtml(
  category: CategoryDoc,
  items: NewsItemDoc[],
  unsubscribeUrl: string,
  note?: string,
): string {
  const rows = items
    .map(
      (it) => `
      <li style="margin-bottom:12px">
        <a href="${escapeHtml(it.url)}" style="font-weight:600;text-decoration:none">${it.title}</a>
        <div style="color:#555;font-size:13px">${it.summary}</div>
        <div style="color:#999;font-size:12px">${escapeHtml(it.platform)}${
          it.publishedAt ? ' · ' + escapeHtml(it.publishedAt.toISOString().slice(0, 10)) : ''
        }</div>
      </li>`,
    )
    .join('');
  return `
  <div style="font-family:system-ui,Arial,sans-serif;max-width:640px;margin:auto">
    <h2>Bản tin: ${escapeHtml(category.name)}</h2>
    ${note ? `<p style="color:#b26a00">${escapeHtml(note)}</p>` : ''}
    <ol>${rows}</ol>
    <hr/>
    <p style="font-size:12px;color:#999">
      Bạn nhận email này vì đã đăng ký danh mục "${escapeHtml(category.name)}".
      <a href="${escapeHtml(unsubscribeUrl)}">Hủy đăng ký</a>.
    </p>
  </div>`;
}
