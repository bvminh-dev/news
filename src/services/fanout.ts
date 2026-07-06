/**
 * Fan-out per-category (tech ADR-02). Có QStash → enqueue tới worker route.
 * Không có → chạy job cục bộ (được gọi trong after() của route để không chặn response).
 */
import { getConfig } from '@/lib/config';
import { enqueue, isQueueEnabled } from '@/adapters/queue';
import { collectCategory } from './collect';
import { sendCategory } from './send';
import { log } from '@/lib/logger';

function baseUrl(): string {
  return getConfig().publicBaseUrl.replace(/\/$/, '');
}

export async function fanoutCollect(date: string, categoryIds: string[], runTimeIso: string): Promise<void> {
  if (isQueueEnabled()) {
    for (const categoryId of categoryIds) {
      await enqueue({ url: `${baseUrl()}/api/worker/collect`, body: { date, categoryId, runTime: runTimeIso } });
    }
    return;
  }
  // Fallback tuần tự (chạy trong after()).
  for (const categoryId of categoryIds) {
    try {
      await collectCategory(categoryId, date, new Date(runTimeIso));
    } catch (e) {
      log.error('fanout.collect_fail', { categoryId, error: e instanceof Error ? e.message : 'err' });
    }
  }
}

export async function fanoutSend(date: string, categoryIds: string[]): Promise<void> {
  if (isQueueEnabled()) {
    for (const categoryId of categoryIds) {
      await enqueue({ url: `${baseUrl()}/api/worker/send`, body: { date, categoryId } });
    }
    return;
  }
  for (const categoryId of categoryIds) {
    try {
      await sendCategory(categoryId, date);
    } catch (e) {
      log.error('fanout.send_fail', { categoryId, error: e instanceof Error ? e.message : 'err' });
    }
  }
}
