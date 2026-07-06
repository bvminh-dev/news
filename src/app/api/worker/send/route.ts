import { NextRequest, NextResponse } from 'next/server';
import { verifyWorker, json } from '@/lib/guard';
import { workerJobSchema } from '@/domain/schemas';
import { sendCategory } from '@/services/send';
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

  try {
    const result = await sendCategory(parsed.data.categoryId, parsed.data.date);
    return json(200, result);
  } catch (e) {
    log.error('worker.send_error', { error: e instanceof Error ? e.message : 'err' });
    return json(500, { error: 'Lỗi xử lý' });
  }
}
