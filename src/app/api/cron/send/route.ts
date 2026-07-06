import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { requireCronSecret, json } from '@/lib/guard';
import { getConfig } from '@/lib/config';
import { localDateString } from '@/domain/idempotency';
import { listSendableCategoryIds } from '@/services/send';
import { fanoutSend } from '@/services/fanout';
import { isQueueEnabled } from '@/adapters/queue';
import { log } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Cron 06:30 ICT (23:30 UTC). Chỉ gửi danh mục đã collected.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const denied = requireCronSecret(req);
  if (denied) return denied;

  const cfg = getConfig();
  const date = localDateString(new Date(), cfg.tz);
  const ids = await listSendableCategoryIds(date);
  log.info('cron.send.trigger', { date, categories: ids.length, queue: isQueueEnabled() });

  const work = fanoutSend(date, ids);
  if (isQueueEnabled()) {
    await work;
  } else {
    after(work);
  }
  return json(202, { accepted: true, date, categories: ids.length });
}
