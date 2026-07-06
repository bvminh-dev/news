import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { requireCronSecret, json } from '@/lib/guard';
import { getConfig } from '@/lib/config';
import { localDateString } from '@/domain/idempotency';
import { listEnabledCategoryIds } from '@/services/collect';
import { fanoutCollect } from '@/services/fanout';
import { isQueueEnabled } from '@/adapters/queue';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Cron 06:00 ICT (23:00 UTC). Trả 202 NGAY, fan-out chạy nội bộ.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const cfg = getConfig();
  const runTime = new Date();
  const date = localDateString(runTime, cfg.tz);
  const ids = await listEnabledCategoryIds();
  log.info('cron.collect.trigger', { date, categories: ids.length, queue: isQueueEnabled() });

  const work = fanoutCollect(date, ids, runTime.toISOString());
  if (isQueueEnabled()) {
    await work; // enqueue nhanh
  } else {
    after(work); // chạy sau khi response trả về
  }
  return json(202, { accepted: true, date, categories: ids.length });
}
