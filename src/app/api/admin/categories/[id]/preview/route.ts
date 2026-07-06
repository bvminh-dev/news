import { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireAdmin, json } from '@/lib/guard';
import { getConfig } from '@/lib/config';
import { localDateString } from '@/domain/idempotency';
import { collections } from '@/models';

export const dynamic = 'force-dynamic';

// Xem trước bản tin hôm nay của 1 danh mục. Nội dung đã sanitize khi thu thập.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) return json(400, { error: 'id không hợp lệ' });

  const cfg = getConfig();
  const date = localDateString(new Date(), cfg.tz);
  const c = await collections();
  const items = await c.news
    .find({ categoryId: new ObjectId(id), date })
    .sort({ rank: 1 })
    .toArray();
  return json(200, {
    date,
    items: items.map((it) => ({
      rank: it.rank,
      title: it.title, // đã sanitize
      url: it.url,
      platform: it.platform,
      summary: it.summary,
      finalScore: it.finalScore,
    })),
  });
}
