/**
 * T8 — Perplexity adapter. Dùng cho tìm + tóm tắt + ước lượng relevance (AI).
 * Chỉ khởi tạo khi có PERPLEXITY_API_KEY (Registry lo việc này).
 */
import { CollectionQuery, RawNewsItem } from '@/domain/types';
import { fetchWithRetry } from '@/lib/http';
import { sanitizeContent } from '@/domain/sanitize';
import { NewsSourceAdapter } from './types';

const ENDPOINT = 'https://api.perplexity.ai/chat/completions';

export class PerplexityAdapter implements NewsSourceAdapter {
  readonly name = 'perplexity';
  constructor(private apiKey: string) {}

  async search(query: CollectionQuery): Promise<RawNewsItem[]> {
    const scopeText = query.scope.join(' + ');
    const prompt =
      `Liệt kê tối đa ${query.topN} tin tức NỔI BẬT trong 24 giờ qua về chủ đề: ` +
      `${query.keywords.join(', ')} (phạm vi: ${scopeText}). ` +
      `Trả về JSON array, mỗi phần tử: {"title","url","publishedAt"(ISO),"summary","relevance"(0..1)}. ` +
      `Chỉ trả JSON, không giải thích. Ngôn ngữ: ${query.lang}.`;

    const res = await fetchWithRetry(
      ENDPOINT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'sonar',
          messages: [{ role: 'user', content: prompt }],
        }),
      },
      { timeoutMs: 30000, retries: 2 },
    );
    if (!res.ok) throw new Error(`Perplexity HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '[]';
    return parseItems(content);
  }
}

function parseItems(content: string): RawNewsItem[] {
  let arr: unknown;
  try {
    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']');
    arr = JSON.parse(jsonStart >= 0 ? content.slice(jsonStart, jsonEnd + 1) : content);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  const out: RawNewsItem[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.url !== 'string' || typeof r.title !== 'string') continue;
    const published = typeof r.publishedAt === 'string' ? new Date(r.publishedAt) : null;
    out.push({
      title: sanitizeContent(r.title),
      url: r.url,
      platform: 'web',
      publishedAt: published && !isNaN(published.getTime()) ? published : null,
      summary: typeof r.summary === 'string' ? sanitizeContent(r.summary) : '',
      rawEngagement: {},
      relevance: typeof r.relevance === 'number' ? clamp01(r.relevance) : undefined,
      sourceAdapter: 'perplexity',
    });
  }
  return out;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
