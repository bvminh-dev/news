/** Kiểu dữ liệu domain (thuần, không phụ thuộc framework). */

export interface CollectionQuery {
  keywords: string[];
  scope: ('VN' | 'WORLD')[];
  windowFrom: Date; // UTC
  windowTo: Date; // UTC
  lang: string;
  topN: number;
}

/** Tin thô do adapter trả (đã map qua ACL của adapter). */
export interface RawNewsItem {
  title: string;
  url: string;
  platform: string;
  publishedAt: Date | null;
  summary: string;
  /** engagement thô theo platform, vd { upvotes: 120, likes: 4000 } */
  rawEngagement: Record<string, number>;
  /** điểm liên quan [0..1] nếu adapter (AI) có ước lượng; nếu không, để undefined */
  relevance?: number;
  sourceAdapter: string;
}

/** Tin đã chuẩn hóa/dedup/rank, sẵn sàng lưu DB. */
export interface RankedNewsItem {
  title: string;
  url: string;
  normalizedUrl: string;
  platform: string;
  sourceAdapters: string[];
  publishedAt: Date | null;
  summary: string;
  rawEngagement: Record<string, number>;
  engagementScore: number;
  relevanceScore: number;
  finalScore: number;
  fingerprint: string;
  rank: number;
}

export const ALGO_VERSION = 'rank-v1-minmax';
