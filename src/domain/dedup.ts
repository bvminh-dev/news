/**
 * T5 — Chống trùng. normalizeUrl bỏ tracking params & chuẩn hóa; buildFingerprint
 * theo tiêu đề chuẩn hóa (bắt tin cùng nội dung khác URL); dedup gộp trong-run.
 */
import { RawNewsItem } from './types';

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'fbclid', 'ref', 'ref_src', 'igshid', 'mc_cid', 'mc_eid',
];

const COMBINING_MARKS = /[̀-ͯ]/g;

export function normalizeUrl(input: string): string {
  try {
    const u = new URL(input.trim());
    u.hash = '';
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
    for (const p of TRACKING_PARAMS) u.searchParams.delete(p);
    // sắp xếp query còn lại để ổn định
    u.searchParams.sort();
    let path = u.pathname.replace(/\/+$/, '');
    if (path === '') path = '/';
    const qs = u.searchParams.toString();
    return `${u.protocol}//${u.hostname}${path}${qs ? '?' + qs : ''}`;
  } catch {
    // Không phải URL hợp lệ → trả về đã trim/lowercase để vẫn có khóa ổn định
    return input.trim().toLowerCase();
  }
}

export function buildFingerprint(title: string): string {
  const norm = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '') // bỏ dấu
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // fingerprint đơn giản, ổn định (không cần crypto)
  return norm;
}

/** Loại trùng trong 1 run theo normalizedUrl; nếu trùng, gộp sourceAdapter + rawEngagement. */
export function dedup(items: RawNewsItem[]): RawNewsItem[] {
  const byUrl = new Map<string, RawNewsItem & { sourceAdapters: string[] }>();
  for (const it of items) {
    const key = normalizeUrl(it.url);
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, { ...it, rawEngagement: { ...it.rawEngagement }, sourceAdapters: [it.sourceAdapter] });
    } else {
      // gộp engagement (cộng dồn) + nguồn
      for (const [k, v] of Object.entries(it.rawEngagement)) {
        existing.rawEngagement[k] = (existing.rawEngagement[k] ?? 0) + v;
      }
      if (!existing.sourceAdapters.includes(it.sourceAdapter)) {
        existing.sourceAdapters.push(it.sourceAdapter);
      }
      // giữ relevance cao nhất
      if ((it.relevance ?? 0) > (existing.relevance ?? 0)) existing.relevance = it.relevance;
    }
  }
  return [...byUrl.values()];
}
