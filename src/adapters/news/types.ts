import { CollectionQuery, RawNewsItem } from '@/domain/types';

/**
 * T8 — Port cho nguồn tin (ACL). Mỗi adapter tự map dữ liệu ngoài → RawNewsItem,
 * tự retry/timeout/fallback; ném lỗi để pipeline ghi nhận & tiếp tục adapter khác.
 */
export interface NewsSourceAdapter {
  readonly name: string;
  search(query: CollectionQuery): Promise<RawNewsItem[]>;
}
