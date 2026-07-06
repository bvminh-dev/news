import { describe, it, expect } from 'vitest';
import { emailSchema, topNSchema, categoryNameSchema, keywordsSchema, scopeSchema } from '@/domain/schemas';

describe('UT-10 emailSchema (chống NoSQLi)', () => {
  it('email hợp lệ pass', () => {
    expect(emailSchema.safeParse('a@b.com').success).toBe(true);
  });
  it('sai định dạng fail', () => {
    expect(emailSchema.safeParse('abc@').success).toBe(false);
    expect(emailSchema.safeParse('a b@x.com').success).toBe(false);
  });
  it('object {$ne:null} bị từ chối', () => {
    expect(emailSchema.safeParse({ $ne: null }).success).toBe(false);
  });
});

describe('UT-11 topNSchema (BVA [1..50])', () => {
  it.each([
    [0, false],
    [1, true],
    [50, true],
    [51, false],
  ])('topN=%s → %s', (v, ok) => {
    expect(topNSchema.safeParse(v).success).toBe(ok);
  });
  it('không phải số fail', () => {
    expect(topNSchema.safeParse('x').success).toBe(false);
  });
});

describe('UT-12 categoryNameSchema', () => {
  it('rỗng/khoảng trắng fail, hợp lệ pass (trim)', () => {
    expect(categoryNameSchema.safeParse('').success).toBe(false);
    expect(categoryNameSchema.safeParse('   ').success).toBe(false);
    expect(categoryNameSchema.safeParse('  AI  ').success).toBe(true);
  });
});

describe('UT-13 keywordsSchema', () => {
  it('rỗng fail, 1 pass, quá dài fail', () => {
    expect(keywordsSchema.safeParse([]).success).toBe(false);
    expect(keywordsSchema.safeParse(['ai']).success).toBe(true);
    expect(keywordsSchema.safeParse(['x'.repeat(101)]).success).toBe(false);
  });
});

describe('UT-14 scopeSchema', () => {
  it('VN/WORLD pass, khác fail', () => {
    expect(scopeSchema.safeParse('VN').success).toBe(true);
    expect(scopeSchema.safeParse('WORLD').success).toBe(true);
    expect(scopeSchema.safeParse('XX').success).toBe(false);
  });
});
