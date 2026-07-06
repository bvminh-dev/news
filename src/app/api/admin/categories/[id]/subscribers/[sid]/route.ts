import { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireAdmin, checkOrigin, json } from '@/lib/guard';
import { collections } from '@/models';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function oid(id: string): ObjectId | null {
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const csrf = checkOrigin(req);
  if (csrf) return csrf;

  const { id, sid } = await params;
  const catId = oid(id);
  const subId = oid(sid);
  if (!catId || !subId) return json(400, { error: 'id không hợp lệ' });

  const c = await collections();
  const res = await c.subscribers.deleteOne({ _id: subId, categoryId: catId });
  if (res.deletedCount === 0) return json(404, { error: 'Không tìm thấy email' });
  log.info('subscriber.delete', { categoryId: id });
  return json(200, { ok: true });
}
