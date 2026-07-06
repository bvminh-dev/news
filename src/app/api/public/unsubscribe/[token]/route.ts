import { NextRequest, NextResponse } from 'next/server';
import { unsubscribeTokenSchema } from '@/domain/schemas';
import { collections, ensureIndexes } from '@/models';
import { rateLimit, clientKey } from '@/lib/rateLimit';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GET public — chỉ set active=false. Phản hồi GENERIC (không tiết lộ email/tồn tại).
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const generic = () =>
    new NextResponse(
      `<!doctype html><meta charset="utf-8"><div data-testid="unsubscribe-result" style="font-family:system-ui;padding:40px">
       <h2>Đã xử lý yêu cầu hủy đăng ký</h2>
       <p>Nếu email của bạn có trong hệ thống, bạn sẽ không nhận bản tin của danh mục này nữa.</p></div>`,
      { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );

  if (!rateLimit(clientKey(req, 'unsub'), 30, 60_000)) return generic();

  const { token } = await params;
  const parsed = unsubscribeTokenSchema.safeParse(token);
  if (!parsed.success) return generic(); // không phân biệt để tránh enumerate

  await ensureIndexes();
  const c = await collections();
  const res = await c.subscribers.updateOne({ unsubscribeToken: parsed.data }, { $set: { active: false } });
  if (res.modifiedCount > 0) log.info('subscriber.unsubscribe', {});
  return generic();
}
