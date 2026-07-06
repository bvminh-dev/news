import { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { randomBytes } from 'crypto';
import { requireAdmin, checkOrigin, json } from '@/lib/guard';
import { addSubscriberSchema } from '@/domain/schemas';
import { collections, ensureIndexes, SubscriberDoc } from '@/models';
import { toSubscriberDTO } from '@/domain/dto';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function oid(id: string): ObjectId | null {
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const _id = oid(id);
  if (!_id) return json(400, { error: 'id không hợp lệ' });
  await ensureIndexes();
  const c = await collections();
  const rows = await c.subscribers.find({ categoryId: _id }).sort({ createdAt: 1 }).toArray();
  return json(200, { subscribers: rows.map(toSubscriberDTO) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const csrf = checkOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  const _id = oid(id);
  if (!_id) return json(400, { error: 'id không hợp lệ' });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'JSON không hợp lệ' });
  }
  const parsed = addSubscriberSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: parsed.error.issues[0]?.message ?? 'Email không hợp lệ' });

  await ensureIndexes();
  const c = await collections();
  const category = await c.categories.findOne({ _id });
  if (!category) return json(404, { error: 'Không tìm thấy danh mục' });

  const doc: SubscriberDoc = {
    categoryId: _id,
    email: parsed.data.email,
    active: true,
    unsubscribeToken: randomBytes(24).toString('hex'),
    createdAt: new Date(),
  };
  try {
    const res = await c.subscribers.insertOne(doc);
    doc._id = res.insertedId;
    log.info('subscriber.add', { categoryId: id });
    return json(201, { subscriber: toSubscriberDTO(doc) });
  } catch (e) {
    if (e instanceof Error && /duplicate key/i.test(e.message)) {
      return json(409, { error: 'Email đã tồn tại trong danh mục' });
    }
    return json(500, { error: 'Lỗi thêm email' });
  }
}
