import { NextRequest, NextResponse } from 'next/server';
import { verifyWorker, json } from '@/lib/guard';
import { workerJobSchema } from '@/domain/schemas';
import { collectCategory } from '@/services/collect';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const denied = verifyWorker(req);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'JSON không hợp lệ' });
  }
  const parsed = workerJobSchema.safeParse(body);
  if (!parsed.success) return json(400, { error: 'Tham số không hợp lệ' });

  const runTime =
    body && typeof (body as { runTime?: string }).runTime === 'string'
      ? new Date((body as { runTime: string }).runTime)
      : new Date();

  try {
    const result = await collectCategory(parsed.data.categoryId, parsed.data.date, runTime);
    return json(200, result);
  } catch (e) {
    log.error('worker.collect_error', { error: e instanceof Error ? e.message : 'err' });
    return json(500, { error: 'Lỗi xử lý' });
  }
}
