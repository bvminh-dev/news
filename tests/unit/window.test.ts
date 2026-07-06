import { describe, it, expect } from 'vitest';
import { isInWindow24h, makeWindow } from '@/domain/window';

describe('UT-04/05 isInWindow24h (UTC)', () => {
  const runTime = new Date('2026-07-06T23:00:00Z');
  const { windowFrom, windowTo } = makeWindow(runTime);

  it('trong 24h → true', () => {
    expect(isInWindow24h(new Date('2026-07-06T12:00:00Z'), windowFrom, windowTo)).toBe(true);
  });
  it('ngay ranh giới -24h → true, quá 1s → false', () => {
    expect(isInWindow24h(new Date('2026-07-05T23:00:00Z'), windowFrom, windowTo)).toBe(true);
    expect(isInWindow24h(new Date('2026-07-05T22:59:59Z'), windowFrom, windowTo)).toBe(false);
  });
  it('publishedAt null → false', () => {
    expect(isInWindow24h(null, windowFrom, windowTo)).toBe(false);
  });
});
