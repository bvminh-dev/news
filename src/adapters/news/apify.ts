/**
 * T8 — Apify adapter (engagement từ nền tảng social: Reddit/X/FB/TikTok/GitHub).
 * Chạy actor đồng bộ (run-sync-get-dataset-items) có timeout; nếu treo/timeout →
 * ném lỗi để pipeline tiếp tục với engagement=0. Chỉ khi có APIFY_TOKEN.
 * Actor id cấu hình qua env APIFY_ACTOR_ID (mặc định actor tìm kiếm chung).
 */
import { CollectionQuery, RawNewsItem } from '@/domain/types';
import { fetchWithRetry } from '@/lib/http';
import { sanitizeContent } from '@/domain/sanitize';
import { isPublicUrl } from '@/domain/ssrf';
import { NewsSourceAdapter } from './types';

export class ApifyAdapter implements NewsSourceAdapter {
  readonly name = 'apify';
  constructor(
    private token: string,
    private actorId: string = process.env.APIFY_ACTOR_ID || 'apify~google-search-scraper',
  ) {}

  async search(query: CollectionQuery): Promise<RawNewsItem[]> {
    const endpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(
      this.actorId,
    )}/run-sync-get-dataset-items?token=${encodeURIComponent(this.token)}`;
    const res = await fetchWithRetry(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: query.keywords.join('\n'),
          maxItems: Math.max(query.topN, 10),
        }),
      },
      { timeoutMs: 60000, retries: 1 },
    );
    if (!res.ok) throw new Error(`Apify HTTP ${res.status}`);
    const rows = (await res.json()) as Record<string, unknown>[];
    if (!Array.isArray(rows)) return [];
    const out: RawNewsItem[] = [];
    for (const r of rows) {
      const url = typeof r.url === 'string' ? r.url : typeof r.link === 'string' ? r.link : '';
      const title = typeof r.title === 'string' ? r.title : '';
      if (!url || !title || !isPublicUrl(url)) continue;
      out.push({
        title: sanitizeContent(title),
        url,
        platform: typeof r.platform === 'string' ? r.platform : 'social',
        publishedAt: parseDate(r.date ?? r.publishedAt),
        summary: sanitizeContent(typeof r.description === 'string' ? r.description : ''),
        rawEngagement: extractEngagement(r),
        sourceAdapter: 'apify',
      });
    }
    return out;
  }
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function extractEngagement(r: Record<string, unknown>): Record<string, number> {
  const keys = ['likes', 'upvotes', 'shares', 'comments', 'retweets', 'stars', 'views'];
  const out: Record<string, number> = {};
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}
