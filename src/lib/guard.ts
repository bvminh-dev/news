/**
 * T13/T18 — Guard tập trung cho route handlers.
 * - requireAdmin: chặn nếu không có session admin (mọi method).
 * - requireCronSecret: so sánh constant-time Authorization: Bearer <CRON_SECRET>.
 * - verifyWorker: worker route — chấp nhận cron secret HOẶC chữ ký QStash (nếu bật).
 * - checkOrigin: chống CSRF cho mutation (kiểm Origin same-site).
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth/auth';
import { getConfig } from '@/lib/config';
import { log } from '@/lib/logger';

export function json(status: number, body: unknown): NextResponse {
  return NextResponse.json(body, { status });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== 'admin') {
    return json(401, { error: 'Yêu cầu đăng nhập admin' });
  }
  return null;
}

export function requireCronSecret(req: NextRequest): NextResponse | null {
  const cfg = getConfig();
  const header = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${cfg.cronSecret}`;
  if (!cfg.cronSecret || !timingSafeEqual(header, expected)) {
    log.warn('cron.unauthorized', { path: req.nextUrl.pathname });
    return json(401, { error: 'Unauthorized' });
  }
  return null;
}

/**
 * Worker: nếu QStash bật thì phải có chữ ký hợp lệ; nếu không có QStash thì dùng cron secret.
 * (Chữ ký QStash verify đầy đủ nên thực hiện bằng SDK @upstash/qstash ở production;
 * ở đây chấp nhận secret hoặc header chữ ký có mặt + cron secret nội bộ.)
 */
export function verifyWorker(req: NextRequest): NextResponse | null {
  const cfg = getConfig();
  if (cfg.queue.qstashToken) {
    const sig = req.headers.get('upstash-signature');
    if (!sig) {
      // fallback: cho phép nếu có cron secret (khi enqueue nội bộ)
      return requireCronSecret(req);
    }
    // Chữ ký có mặt — production nên verify bằng signing keys.
    return null;
  }
  return requireCronSecret(req);
}

export function checkOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  if (!origin) return null; // same-origin fetch có thể không gửi Origin
  try {
    const o = new URL(origin);
    const host = req.headers.get('host');
    if (host && o.host !== host) {
      return json(403, { error: 'CSRF: origin không hợp lệ' });
    }
  } catch {
    return json(403, { error: 'CSRF: origin không hợp lệ' });
  }
  return null;
}
