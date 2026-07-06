import { NextRequest } from 'next/server';
import { requireAdmin, checkOrigin, json } from '@/lib/guard';
import { getConfig } from '@/lib/config';
import { workerJobSchema } from '@/domain/schemas';
import { localDateString } from '@/domain/idempotency';
import { collectCategory } from '@/services/collect';
import { rateLimit, clientKey } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Chạy thu thập thủ công cho 1 danh mục (admin). Body: { categoryId }
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const csrf = checkOrigin(req);
  if (csrf) return csrf;
  if (!rateLimit(clientKey(req, 'run-now'), 10, 60_000)) {
    return json(429, { error: 'Quá nhiều yêu cầu, thử lại sau' });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'JSON không hợp lệ' });
  }
  const cfg = getConfig();
  const date = localDateString(new Date(), cfg.tz);
  const parsed = workerJobSchema.pick({ categoryId: true }).safeParse(body);
  if (!parsed.success) return json(400, { error: 'categoryId không hợp lệ' });

  const result = await collectCategory(parsed.data.categoryId, date, new Date());
  return json(200, { date, result });
}
