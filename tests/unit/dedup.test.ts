import { describe, it, expect } from 'vitest';
import { normalizeUrl, buildFingerprint, dedup } from '@/domain/dedup';
import { RawNewsItem } from '@/domain/types';

function raw(url: string, title = 't', adapter = 'perplexity', eng: Record<string, number> = {}): RawNewsItem {
  return { url, title, platform: 'web', publishedAt: null, summary: '', rawEngagement: eng, sourceAdapter: adapter };
}

describe('UT-01 normalizeUrl', () => {
  it('bỏ utm & trailing slash, cùng khóa', () => {
    expect(normalizeUrl('https://a.com/x?utm_source=1')).toBe(normalizeUrl('https://a.com/x/'));
  });
  it('bỏ www và hash', () => {
    expect(normalizeUrl('https://www.a.com/p#frag')).toBe('https://a.com/p');
  });
});

describe('UT-02 buildFingerprint', () => {
  it('cùng tiêu đề khác dấu/hoa thường → cùng fingerprint', () => {
    expect(buildFingerprint('Giá Vàng Tăng!')).toBe(buildFingerprint('gia vang tang'));
  });
});

describe('UT-03 dedup trong-run', () => {
  it('loại trùng theo normalizedUrl, gộp nguồn + engagement', () => {
    const out = dedup([
      raw('https://a.com/x?utm_source=1', 't', 'perplexity', { likes: 10 }),
      raw('https://a.com/x', 't', 'apify', { likes: 5 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].rawEngagement.likes).toBe(15);
  });
});
