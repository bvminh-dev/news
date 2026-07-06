import { describe, it, expect } from 'vitest';
import { normalizeEngagement, computeFinalScore, selectTopN, rawEngagementTotal } from '@/domain/ranking';
import { RawNewsItem } from '@/domain/types';

function raw(url: string, platform: string, eng: Record<string, number>, relevance?: number, title = url): RawNewsItem {
  return { url, title, platform, publishedAt: null, summary: '', rawEngagement: eng, relevance, sourceAdapter: 'apify' };
}

describe('UT-06 normalizeEngagement (min-max theo platform)', () => {
  it('chuẩn hóa [0..1] trong cùng platform', () => {
    const items = [raw('https://a/1', 'reddit', { upvotes: 0 }), raw('https://a/2', 'reddit', { upvotes: 100 })];
    const m = normalizeEngagement(items);
    expect(m.get('https://a/1')).toBe(0);
    expect(m.get('https://a/2')).toBe(1);
  });
});

describe('UT-07 computeFinalScore', () => {
  it('0.6*0.8 + 0.4*0.5 = 0.68', () => {
    expect(computeFinalScore(0.8, 0.5, { relevance: 0.6, engagement: 0.4 })).toBeCloseTo(0.68, 5);
  });
});

describe('UT-08/09 selectTopN', () => {
  const weights = { relevance: 0.6, engagement: 0.4 };
  it('cắt còn N và gán rank giảm dần theo finalScore', () => {
    const items = Array.from({ length: 15 }, (_, i) => raw(`https://a/${i}`, 'web', {}, i / 15));
    const top = selectTopN(items, 10, weights);
    expect(top).toHaveLength(10);
    expect(top[0].rank).toBe(1);
    expect(top[0].finalScore).toBeGreaterThanOrEqual(top[9].finalScore);
  });
  it('thiếu tin → trả đúng số có', () => {
    const items = [raw('https://a/1', 'web', {}, 0.9), raw('https://a/2', 'web', {}, 0.5)];
    expect(selectTopN(items, 10, weights)).toHaveLength(2);
  });
});

describe('rawEngagementTotal', () => {
  it('cộng mọi metric', () => {
    expect(rawEngagementTotal({ likes: 3, shares: 2 })).toBe(5);
  });
});
