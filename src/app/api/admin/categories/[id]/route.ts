import { NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { requireAdmin, checkOrigin, json } from '@/lib/guard';
import { updateCategorySchema } from '@/domain/schemas';
import { collections, ensureIndexes } from '@/models';
import { toCategoryDTO } from '@/domain/dto';
import { slugify } from '@/domain/slug';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function oid(id: string): ObjectId | null {
  return /^[a-f0-9]{24}$/i.test(id) ? new ObjectId(id) : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) return json(400, { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });

  await ensureIndexes();
  const c = await collections();
  const update: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.name) update.slug = slugify(parsed.data.name);
  try {
    const res = await c.categories.findOneAndUpdate({ _id }, { $set: update }, { returnDocument: 'after' });
    if (!res) return json(404, { error: 'Không tìm thấy danh mục' });
    await c.audits.insertOne({ actor: 'admin', action: 'category.update', target: id, after: parsed.data, at: new Date() });
    log.info('category.update', { id });
    return json(200, { category: toCategoryDTO(res) });
  } catch (e) {
    if (e instanceof Error && /duplicate key/i.test(e.message)) return json(409, { error: 'Tên danh mục đã tồn tại' });
    return json(500, { error: 'Lỗi cập nhật' });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const csrf = checkOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  const _id = oid(id);
  if (!_id) return json(400, { error: 'id không hợp lệ' });

  await ensureIndexes();
  const c = await collections();
  const res = await c.categories.deleteOne({ _id });
  if (res.deletedCount === 0) return json(404, { error: 'Không tìm thấy danh mục' });
  // dọn dữ liệu liên quan để tránh orphan
  await c.subscribers.deleteMany({ categoryId: _id });
  await c.news.deleteMany({ categoryId: _id });
  await c.audits.insertOne({ actor: 'admin', action: 'category.delete', target: id, at: new Date() });
  log.info('category.delete', { id });
  return json(200, { ok: true });
}
