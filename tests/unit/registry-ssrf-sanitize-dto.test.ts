import { describe, it, expect } from 'vitest';
import { ObjectId } from 'mongodb';
import { buildActiveAdapters } from '@/adapters/news/registry';
import { isPublicUrl } from '@/domain/ssrf';
import { sanitizeContent } from '@/domain/sanitize';
import { toCategoryDTO, toSubscriberDTO } from '@/domain/dto';
import { idempotencyKey, localDateString } from '@/domain/idempotency';
import { CategoryDoc, SubscriberDoc } from '@/models';

describe('UT-16 buildActiveAdapters theo env', () => {
  it('đủ key → 3 adapter', () => {
    expect(buildActiveAdapters({ perplexityKey: 'a', firecrawlKey: 'b', apifyToken: 'c' })).toHaveLength(3);
  });
  it('chỉ perplexity → 1 adapter', () => {
    const a = buildActiveAdapters({ perplexityKey: 'a', firecrawlKey: '', apifyToken: '' });
    expect(a).toHaveLength(1);
    expect(a[0].name).toBe('perplexity');
  });
  it('không key → 0 adapter', () => {
    expect(buildActiveAdapters({ perplexityKey: '', firecrawlKey: '', apifyToken: '' })).toHaveLength(0);
  });
});

describe('UT-18 isPublicUrl (SSRF)', () => {
  it.each([
    ['http://169.254.169.254/latest/meta-data', false],
    ['http://localhost:3000', false],
    ['http://127.0.0.1', false],
    ['http://10.0.0.5', false],
    ['http://192.168.1.1', false],
    ['ftp://a.com', false],
    ['https://example.com/x', true],
  ])('%s → %s', (url, ok) => {
    expect(isPublicUrl(url)).toBe(ok);
  });
});

describe('UT-17 sanitizeContent (XSS)', () => {
  it('loại thẻ & escape', () => {
    const out = sanitizeContent('<script>alert(1)</script>Giá vàng');
    expect(out).not.toContain('<script>');
    expect(out).toContain('Giá vàng');
  });
});

describe('UT-19 DTO loại field nhạy cảm', () => {
  it('subscriber DTO không có unsubscribeToken', () => {
    const s: SubscriberDoc = {
      _id: new ObjectId(),
      categoryId: new ObjectId(),
      email: 'a@b.com',
      active: true,
      unsubscribeToken: 'secret-token',
      createdAt: new Date(),
    };
    const dto = toSubscriberDTO(s) as Record<string, unknown>;
    expect(dto.unsubscribeToken).toBeUndefined();
    expect(dto.email).toBe('a@b.com');
  });
  it('category DTO ổn', () => {
    const c: CategoryDoc = {
      _id: new ObjectId(),
      name: 'AI',
      slug: 'ai',
      keywords: ['ai'],
      scope: ['VN'],
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(toCategoryDTO(c).name).toBe('AI');
  });
});

describe('UT-20 idempotencyKey + localDateString', () => {
  it('khóa ổn định', () => {
    expect(idempotencyKey('2026-07-06', 'abc', 'collect')).toBe('2026-07-06::abc::collect');
  });
  it('localDateString theo TZ ICT', () => {
    // 2026-07-06T18:00:00Z = 2026-07-07 01:00 ICT
    expect(localDateString(new Date('2026-07-06T18:00:00Z'), 'Asia/Ho_Chi_Minh')).toBe('2026-07-07');
  });
});
