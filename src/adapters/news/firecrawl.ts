/**
 * T8 — Firecrawl adapter (search). Áp SSRF guard: loại mọi URL không công khai.
 * Chỉ khởi tạo khi có FIRECRAWL_API_KEY.
 */
import { CollectionQuery, RawNewsItem } from '@/domain/types';
import { fetchWithRetry } from '@/lib/http';
import { sanitizeContent } from '@/domain/sanitize';
import { isPublicUrl } from '@/domain/ssrf';
import { NewsSourceAdapter } from './types';

const ENDPOINT = 'https://api.firecrawl.dev/v1/search';

export class FirecrawlAdapter implements NewsSourceAdapter {
  readonly name = 'firecrawl';
  constructor(private apiKey: string) {}

  async search(query: CollectionQuery): Promise<RawNewsItem[]> {
    const q = `${query.keywords.join(' ')} tin tức 24h ${query.scope.join(' ')}`;
    const res = await fetchWithRetry(
      ENDPOINT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: q, limit: Math.max(query.topN, 10) }),
      },
      { timeoutMs: 30000, retries: 2 },
    );
    if (!res.ok) throw new Error(`Firecrawl HTTP ${res.status}`);
    const data = (await res.json()) as { data?: Record<string, unknown>[] };
    const rows = Array.isArray(data.data) ? data.data : [];
    const out: RawNewsItem[] = [];
    for (const r of rows) {
      const url = typeof r.url === 'string' ? r.url : '';
      const title = typeof r.title === 'string' ? r.title : '';
      if (!url || !title) continue;
      if (!isPublicUrl(url)) continue; // SSRF guard
      out.push({
        title: sanitizeContent(title),
        url,
        platform: 'web',
        publishedAt: null,
        summary: sanitizeContent(typeof r.description === 'string' ? r.description : ''),
        rawEngagement: {},
        sourceAdapter: 'firecrawl',
      });
    }
    return out;
  }
}
