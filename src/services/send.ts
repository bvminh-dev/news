/**
 * T12 — Send pipeline cho 1 danh mục.
 * - CHỈ gửi khi digest_runs(collect) = collected|partial (KHÔNG gửi email rỗng).
 * - Idempotent theo (date,categoryId,email): đã sent → bỏ qua.
 * - Retry người nhận lỗi (1 lần); ghi delivery_logs; run 'send' = sent|partial|failed.
 */
import { ObjectId } from 'mongodb';
import { getConfig } from '@/lib/config';
import { collections, ensureIndexes, CategoryDoc } from '@/models';
import { renderDigestHtml } from './digest';
import { sendMail, sendAlert } from '@/adapters/mail';
import { log, maskEmail } from '@/lib/logger';

export interface SendResult {
  status: 'sent' | 'partial' | 'failed' | 'skipped';
  total: number;
  sent: number;
  failed: number;
  reason?: string;
}

export async function sendCategory(categoryId: string, date: string): Promise<SendResult> {
  const cfg = getConfig();
  await ensureIndexes();
  const c = await collections();
  const catObjId = new ObjectId(categoryId);
  const category = (await c.categories.findOne({ _id: catObjId })) as CategoryDoc | null;
  if (!category) return { status: 'skipped', total: 0, sent: 0, failed: 0, reason: 'category-missing' };

  // Guard: không gửi nếu collect chưa xong (chống email rỗng).
  const collectRun = await c.runs.findOne({ date, categoryId: catObjId, step: 'collect' });
  if (!collectRun || (collectRun.status !== 'collected' && collectRun.status !== 'partial')) {
    log.warn('send.blocked_no_collect', { categoryId, date, collectStatus: collectRun?.status ?? 'none' });
    await sendAlert('Bỏ gửi (chưa thu thập)', `Danh mục "${category.name}" (${date}): collect chưa hoàn tất (status=${collectRun?.status ?? 'none'}). Không gửi email rỗng.`);
    return { status: 'skipped', total: 0, sent: 0, failed: 0, reason: 'collect-not-ready' };
  }

  const items = await c.news.find({ categoryId: catObjId, date }).sort({ rank: 1 }).toArray();
  if (items.length === 0) {
    return { status: 'skipped', total: 0, sent: 0, failed: 0, reason: 'no-items' };
  }

  const subscribers = await c.subscribers.find({ categoryId: catObjId, active: true }).toArray();
  if (subscribers.length === 0) {
    log.info('send.no_subscriber', { categoryId, date });
    return { status: 'skipped', total: 0, sent: 0, failed: 0, reason: 'no-subscriber' };
  }

  await c.runs.updateOne(
    { date, categoryId: catObjId, step: 'send' },
    {
      $set: { status: 'sending', startedAt: new Date() },
      $setOnInsert: { date, categoryId: catObjId, step: 'send', counts: { found: items.length, selected: items.length }, toolsUsed: [], errors: [] },
    },
    { upsert: true },
  );

  const note = collectRun.counts.selected < (category.topN ?? cfg.defaultTopN)
    ? `Chỉ tìm được ${collectRun.counts.selected}/${category.topN ?? cfg.defaultTopN} tin.`
    : undefined;

  let sent = 0;
  let failed = 0;
  for (const sub of subscribers) {
    // Idempotent: đã sent hôm nay → bỏ qua.
    const prev = await c.deliveries.findOne({ date, categoryId: catObjId, email: sub.email });
    if (prev && prev.status === 'sent') {
      sent++;
      continue;
    }
    const unsubUrl = `${cfg.publicBaseUrl}/api/public/unsubscribe/${sub.unsubscribeToken}`;
    const html = renderDigestHtml(category, items, unsubUrl, note);

    let result = await sendMail(sub.email, `Bản tin ${category.name} — ${date}`, html);
    if (!result.ok) result = await sendMail(sub.email, `Bản tin ${category.name} — ${date}`, html); // retry 1 lần

    await c.deliveries.updateOne(
      { date, categoryId: catObjId, email: sub.email },
      {
        $set: {
          status: result.ok ? 'sent' : 'failed',
          error: result.ok ? undefined : result.error,
          sentAt: result.ok ? new Date() : undefined,
        },
        $inc: { attempts: 1 },
        $setOnInsert: { date, categoryId: catObjId, email: sub.email },
      },
      { upsert: true },
    );
    if (result.ok) sent++;
    else {
      failed++;
      log.warn('send.delivery_fail', { categoryId, email: maskEmail(sub.email), error: result.error });
    }
  }

  const status: SendResult['status'] = failed === 0 ? 'sent' : sent > 0 ? 'partial' : 'failed';
  await c.runs.updateOne(
    { date, categoryId: catObjId, step: 'send' },
    { $set: { status: status === 'sent' ? 'sent' : status === 'partial' ? 'partial' : 'failed', finishedAt: new Date(), errors: failed ? [`${failed} email lỗi`] : [] } },
  );
  if (failed > 0) await sendAlert('Gửi email lỗi một phần', `Danh mục "${category.name}" (${date}): ${sent} thành công, ${failed} lỗi.`);
  log.info('send.done', { categoryId, date, status, sent, failed });

  return { status, total: subscribers.length, sent, failed };
}

/** Danh mục đã collected|partial cho ngày → để fan-out gửi. */
export async function listSendableCategoryIds(date: string): Promise<string[]> {
  await ensureIndexes();
  const c = await collections();
  const rows = await c.runs
    .find({ date, step: 'collect', status: { $in: ['collected', 'partial'] } })
    .project<{ categoryId: ObjectId }>({ categoryId: 1 })
    .toArray();
  return rows.map((r) => r.categoryId.toString());
}
