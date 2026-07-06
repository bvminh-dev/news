import { NextRequest } from 'next/server';
import { requireAdmin, checkOrigin, json } from '@/lib/guard';
import { createCategorySchema } from '@/domain/schemas';
import { collections, ensureIndexes, CategoryDoc } from '@/models';
import { toCategoryDTO } from '@/domain/dto';
import { slugify } from '@/domain/slug';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// GET danh sách danh mục
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  await ensureIndexes();
  const c = await collections();
  const rows = await c.categories.find({}).sort({ createdAt: -1 }).toArray();
  return json(200, { categories: rows.map(toCategoryDTO) });
}

// POST tạo danh mục
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const csrf = checkOrigin(req);
  if (csrf) return csrf;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'JSON không hợp lệ' });
  }
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: parsed.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ' });
  }
  await ensureIndexes();
  const c = await collections();
  const now = new Date();
  const slug = slugify(parsed.data.name);
  const doc: CategoryDoc = {
    name: parsed.data.name,
    slug,
    description: parsed.data.description,
    keywords: parsed.data.keywords,
    scope: parsed.data.scope,
    topN: parsed.data.topN,
    lang: parsed.data.lang,
    enabled: parsed.data.enabled,
    createdAt: now,
    updatedAt: now,
  };
  try {
    const res = await c.categories.insertOne(doc);
    doc._id = res.insertedId;
    await c.audits.insertOne({ actor: 'admin', action: 'category.create', target: slug, after: { name: doc.name }, at: now });
    log.info('category.create', { slug });
    return json(201, { category: toCategoryDTO(doc) });
  } catch (e) {
    if (e instanceof Error && /duplicate key/i.test(e.message)) {
      return json(409, { error: 'Tên danh mục đã tồn tại' });
    }
    return json(500, { error: 'Lỗi tạo danh mục' });
  }
}
