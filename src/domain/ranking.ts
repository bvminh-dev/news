/**
 * T7 — Xếp hạng nổi bật = kết hợp AI relevance + engagement (tech ADR-05).
 * - normalizeEngagement: min-max theo platform (tin cùng platform so với nhau) → [0..1].
 * - computeFinalScore: w_rel*relevance + w_eng*engagementNorm.
 * - selectTopN: sắp giảm dần theo finalScore, cắt N, gán rank.
 */
import { RawNewsItem, RankedNewsItem, ALGO_VERSION } from './types';
import { normalizeUrl, buildFingerprint } from './dedup';

export interface RankWeights {
  relevance: number;
  engagement: number;
}

/** Tổng engagement thô của 1 item (cộng mọi metric). */
export function rawEngagementTotal(raw: Record<string, number>): number {
  return Object.values(raw).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}

/**
 * Chuẩn hóa engagement theo platform bằng min-max. Trả về Map url→[0..1].
 * Nếu 1 platform chỉ có 1 item hoặc mọi item bằng nhau → điểm 1 (hoặc 0 nếu total=0).
 */
export function normalizeEngagement(items: RawNewsItem[]): Map<string, number> {
  const byPlatform = new Map<string, RawNewsItem[]>();
  for (const it of items) {
    const arr = byPlatform.get(it.platform) ?? [];
    arr.push(it);
    byPlatform.set(it.platform, arr);
  }
  const result = new Map<string, number>();
  for (const [, arr] of byPlatform) {
    const totals = arr.map((it) => rawEngagementTotal(it.rawEngagement));
    const min = Math.min(...totals);
    const max = Math.max(...totals);
    arr.forEach((it, i) => {
      const total = totals[i];
      let norm: number;
      if (max === min) norm = total > 0 ? 1 : 0;
      else norm = (total - min) / (max - min);
      result.set(normalizeUrl(it.url), norm);
    });
  }
  return result;
}

export function computeFinalScore(relevance: number, engagementNorm: number, w: RankWeights): number {
  const denom = w.relevance + w.engagement || 1;
  return (w.relevance * relevance + w.engagement * engagementNorm) / denom;
}

/**
 * Xếp hạng & chọn Top N. items đã dedup trong-run. Trả RankedNewsItem[] (≤ N).
 * relevance mặc định 0.5 nếu adapter không cung cấp (không phạt/thưởng thái quá).
 */
export function selectTopN(
  items: (RawNewsItem & { sourceAdapters?: string[] })[],
  topN: number,
  weights: RankWeights,
): RankedNewsItem[] {
  const engNorm = normalizeEngagement(items);
  const scored: RankedNewsItem[] = items.map((it) => {
    const nurl = normalizeUrl(it.url);
    const relevance = typeof it.relevance === 'number' ? it.relevance : 0.5;
    const engagementScore = engNorm.get(nurl) ?? 0;
    const finalScore = computeFinalScore(relevance, engagementScore, weights);
    return {
      title: it.title,
      url: it.url,
      normalizedUrl: nurl,
      platform: it.platform,
      sourceAdapters: it.sourceAdapters ?? [it.sourceAdapter],
      publishedAt: it.publishedAt,
      summary: it.summary,
      rawEngagement: it.rawEngagement,
      engagementScore,
      relevanceScore: relevance,
      finalScore,
      fingerprint: buildFingerprint(it.title),
      rank: 0,
    };
  });
  scored.sort((a, b) => b.finalScore - a.finalScore);
  const top = scored.slice(0, Math.max(0, topN));
  top.forEach((it, i) => (it.rank = i + 1));
  return top;
}

export { ALGO_VERSION };
