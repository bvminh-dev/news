/**
 * FT-07 (mức logic pipeline, không DB): dedup → lọc window 24h → rank → Top N.
 * Kiểm luồng lõi mà collectCategory dùng. (Test DB-backed đầy đủ cần mongodb-memory-server.)
 */
import { describe, it, expect } from 'vitest';
import { dedup } from '@/domain/dedup';
import { isInWindow24h, makeWindow } from '@/domain/window';
import { selectTopN } from '@/domain/ranking';
import { RawNewsItem } from '@/domain/types';

const runTime = new Date('2026-07-06T23:00:00Z');
const { windowFrom, windowTo } = makeWindow(runTime);

function raw(url: string, opts: Partial<RawNewsItem> = {}): RawNewsItem {
  return {
    url,
    title: opts.title ?? url,
    platform: opts.platform ?? 'web',
    publishedAt: opts.publishedAt ?? new Date('2026-07-06T12:00:00Z'),
    summary: '',
    rawEngagement: opts.rawEngagement ?? {},
    relevance: opts.relevance,
    sourceAdapter: opts.sourceAdapter ?? 'perplexity',
  };
}

describe('FT-07 collect pipeline (dedup+window+rank+topN)', () => {
  it('loại trùng, loại ngoài 24h, ra Top N không trùng', () => {
    const items: RawNewsItem[] = [
      raw('https://a.com/1?utm_source=x', { relevance: 0.9, rawEngagement: { likes: 100 } }),
      raw('https://a.com/1', { relevance: 0.9, sourceAdapter: 'apify', rawEngagement: { likes: 50 } }), // trùng URL
      raw('https://a.com/old', { publishedAt: new Date('2026-07-01T00:00:00Z'), relevance: 1 }), // ngoài 24h
      raw('https://a.com/2', { relevance: 0.7 }),
      raw('https://a.com/3', { relevance: 0.5 }),
    ];
    let deduped = dedup(items);
    deduped = deduped.filter((it) => it.publishedAt === null || isInWindow24h(it.publishedAt, windowFrom, windowTo));
    const top = selectTopN(deduped, 10, { relevance: 0.6, engagement: 0.4 });

    // old bị loại (ngoài 24h) ⇒ còn 3 tin
    expect(top).toHaveLength(3);
    // không có URL trùng
    const urls = top.map((t) => t.normalizedUrl);
    expect(new Set(urls).size).toBe(urls.length);
    // engagement của tin trùng đã gộp (100+50)
    const merged = top.find((t) => t.normalizedUrl === 'https://a.com/1');
    expect(merged?.rawEngagement.likes).toBe(150);
    // rank tăng dần
    expect(top[0].rank).toBe(1);
  });

  it('FT-08 không engagement (chỉ relevance) vẫn rank được', () => {
    const items = [raw('https://a/1', { relevance: 0.9 }), raw('https://a/2', { relevance: 0.3 })];
    const top = selectTopN(items, 10, { relevance: 0.6, engagement: 0.4 });
    expect(top[0].url).toBe('https://a/1');
  });
});
