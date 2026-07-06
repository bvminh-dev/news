/**
 * T18 — Rate limit đơn giản in-memory (sliding token bucket theo key).
 * Ghi chú: trên serverless nhiều instance, để chống brute-force nghiêm túc nên
 * dùng Upstash Ratelimit (env). Đây là lớp phòng thủ cơ bản cho login/unsubscribe/run-now.
 */
interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

export function clientKey(req: { headers: Headers }, scope: string): string {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const ip = fwd.split(',')[0].trim() || 'unknown';
  return `${scope}:${ip}`;
}
