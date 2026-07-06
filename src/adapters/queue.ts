/**
 * T10 — Queue adapter fan-out (tech ADR-02).
 * - Có QSTASH_TOKEN → publish message tới worker route qua QStash (QStash tự retry).
 * - Không có → fallback: gọi trực tiếp worker cục bộ (tuần tự) — dùng cho dev/scale nhỏ.
 * verifyQStashSignature: kiểm chữ ký ở worker route (nếu bật QStash).
 */
import { getConfig } from '@/lib/config';
import { fetchWithRetry } from '@/lib/http';
import { log } from '@/lib/logger';

export interface EnqueueTarget {
  /** đường dẫn worker tuyệt đối, vd https://app/api/worker/collect */
  url: string;
  body: unknown;
}

export function isQueueEnabled(): boolean {
  return Boolean(getConfig().queue.qstashToken);
}

/**
 * Enqueue job. Trả về true nếu đã đẩy qua QStash; false nếu caller cần tự xử lý fallback.
 */
export async function enqueue(target: EnqueueTarget): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg.queue.qstashToken) return false;
  const publishUrl = `https://qstash.upstash.io/v2/publish/${target.url}`;
  await fetchWithRetry(
    publishUrl,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.queue.qstashToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(target.body),
    },
    { timeoutMs: 15000, retries: 2 },
  );
  log.info('queue.enqueued', { url: target.url });
  return true;
}
