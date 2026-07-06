/**
 * T11 — Collect pipeline cho 1 danh mục (idempotent theo (date,categoryId,'collect')).
 * Luồng: đọc adapter theo env → gọi song song (fail-soft) → dedup trong-run →
 * lọc window 24h → loại tin đã có trong dedup window (DB) → rank → chọn Top N →
 * upsert news_items → cập nhật digest_runs. Alert khi no-adapter/fail.
 */
import { ObjectId } from 'mongodb';
import { getConfig } from '@/lib/config';
import { collections, ensureIndexes, CategoryDoc, NewsItemDoc } from '@/models';
import { buildActiveAdapters } from '@/adapters/news/registry';
import { dedup, normalizeUrl } from '@/domain/dedup';
import { isInWindow24h, makeWindow } from '@/domain/window';
import { selectTopN, ALGO_VERSION } from '@/domain/ranking';
import { CollectionQuery, RawNewsItem } from '@/domain/types';
import { sendAlert } from '@/adapters/mail';
import { log } from '@/lib/logger';

export interface CollectResult {
  status: 'collected' | 'failed' | 'partial';
  found: number;
  selected: number;
  toolsUsed: string[];
  errors: string[];
}

export async function collectCategory(
  categoryId: string,
  date: string,
  runTime: Date,
): Promise<CollectResult> {
  const cfg = getConfig();
  await ensureIndexes();
  const c = await collections();
  const category = (await c.categories.findOne({ _id: new ObjectId(categoryId) })) as CategoryDoc | null;

  if (!category || !category.enabled) {
    return { status: 'failed', found: 0, selected: 0, toolsUsed: [], errors: ['category-missing-or-disabled'] };
  }

  // Idempotency: nếu đã collected hôm nay → no-op.
  const existing = await c.runs.findOne({ date, categoryId: category._id, step: 'collect' });
  if (existing && existing.status === 'collected') {
    return {
      status: 'collected',
      found: existing.counts.found,
      selected: existing.counts.selected,
      toolsUsed: existing.toolsUsed,
      errors: [],
    };
  }

  await c.runs.updateOne(
    { date, categoryId: category._id, step: 'collect' },
    {
      $set: { status: 'collecting', startedAt: runTime },
      $setOnInsert: { date, categoryId: category._id, step: 'collect', counts: { found: 0, selected: 0 }, toolsUsed: [], errors: [] },
    },
    { upsert: true },
  );

  const adapters = buildActiveAdapters(cfg.tools);
  if (adapters.length === 0) {
    await c.runs.updateOne(
      { date, categoryId: category._id, step: 'collect' },
      { $set: { status: 'failed', errors: ['no-adapter'], finishedAt: new Date() } },
    );
    await sendAlert('Thu thập thất bại', `Danh mục "${category.name}" (${date}): không có công cụ thu thập nào (thiếu env key).`);
    log.error('collect.no_adapter', { categoryId, date });
    return { status: 'failed', found: 0, selected: 0, toolsUsed: [], errors: ['no-adapter'] };
  }

  const topN = category.topN ?? cfg.defaultTopN;
  const { windowFrom, windowTo } = makeWindow(runTime);
  const query: CollectionQuery = {
    keywords: category.keywords,
    scope: category.scope,
    windowFrom,
    windowTo,
    lang: category.lang ?? cfg.lang,
    topN,
  };

  const toolsUsed: string[] = [];
  const errors: string[] = [];
  const collected: RawNewsItem[] = [];

  const results = await Promise.allSettled(adapters.map((a) => a.search(query)));
  results.forEach((r, i) => {
    const name = adapters[i].name;
    if (r.status === 'fulfilled') {
      toolsUsed.push(name);
      collected.push(...r.value);
    } else {
      errors.push(`${name}: ${r.reason instanceof Error ? r.reason.message : 'lỗi'}`);
      log.warn('collect.adapter_fail', { adapter: name, categoryId });
    }
  });

  // dedup trong-run
  let deduped = dedup(collected);
  // lọc window 24h — chỉ giữ tin không có publishedAt HOẶC nằm trong 24h.
  deduped = deduped.filter((it) => it.publishedAt === null || isInWindow24h(it.publishedAt, windowFrom, windowTo));

  // loại tin đã có trong dedup window (DB) theo normalizedUrl.
  const fromDate = dateNDaysBefore(date, cfg.dedupWindowDays);
  const normUrls = deduped.map((it) => normalizeUrl(it.url));
  const seen = await c.news
    .find({ categoryId: category._id, normalizedUrl: { $in: normUrls }, date: { $gte: fromDate } })
    .project<{ normalizedUrl: string }>({ normalizedUrl: 1 })
    .toArray();
  const seenSet = new Set(seen.map((s) => s.normalizedUrl));
  const fresh = deduped.filter((it) => !seenSet.has(normalizeUrl(it.url)));

  // rank + chọn Top N
  const ranked = selectTopN(fresh, topN, { relevance: cfg.weightRelevance, engagement: cfg.weightEngagement });

  // upsert news_items (idempotent theo (categoryId, normalizedUrl))
  const now = new Date();
  for (const item of ranked) {
    // BUG-1: KHÔNG đặt createdAt trong $set (tránh xung đột với $setOnInsert).
    // BUG-2: khóa upsert gồm date → không đè bản ghi ngày khác (giữ lịch sử), vẫn idempotent trong-ngày.
    const setFields: Omit<NewsItemDoc, 'createdAt' | '_id'> = {
      categoryId: category._id!,
      date,
      title: item.title,
      url: item.url,
      normalizedUrl: item.normalizedUrl,
      platform: item.platform,
      sourceAdapters: item.sourceAdapters,
      publishedAt: item.publishedAt,
      summary: item.summary,
      rawEngagement: item.rawEngagement,
      engagementScore: item.engagementScore,
      relevanceScore: item.relevanceScore,
      finalScore: item.finalScore,
      rank: item.rank,
      fingerprint: item.fingerprint,
      algoVersion: ALGO_VERSION,
    };
    await c.news.updateOne(
      { categoryId: category._id, date, normalizedUrl: item.normalizedUrl },
      { $set: setFields, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
  }

  const status: CollectResult['status'] = errors.length && toolsUsed.length ? 'partial' : toolsUsed.length ? 'collected' : 'failed';
  await c.runs.updateOne(
    { date, categoryId: category._id, step: 'collect' },
    { $set: { status, toolsUsed, errors, counts: { found: fresh.length, selected: ranked.length }, finishedAt: new Date() } },
  );

  if (status === 'failed') {
    await sendAlert('Thu thập thất bại', `Danh mục "${category.name}" (${date}): mọi công cụ lỗi.\n${errors.join('\n')}`);
  } else if (status === 'partial') {
    await sendAlert('Thu thập một phần', `Danh mục "${category.name}" (${date}): lỗi một phần.\n${errors.join('\n')}`);
  }
  log.info('collect.done', { categoryId, date, status, selected: ranked.length, found: fresh.length });

  return { status, found: fresh.length, selected: ranked.length, toolsUsed, errors };
}

function dateNDaysBefore(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Liệt kê id các danh mục enabled (để fan-out). */
export async function listEnabledCategoryIds(): Promise<string[]> {
  await ensureIndexes();
  const c = await collections();
  const rows = await c.categories.find({ enabled: true }).project<{ _id: ObjectId }>({ _id: 1 }).toArray();
  return rows.map((r) => r._id.toString());
}
