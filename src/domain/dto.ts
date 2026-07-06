/**
 * T14/T19 — DTO: loại field nhạy cảm khỏi response (security.md §Data Leakage / API3).
 */
import { CategoryDoc, SubscriberDoc } from '@/models';

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  description: string;
  keywords: string[];
  scope: string[];
  topN: number | null;
  lang: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriberDTO {
  id: string;
  categoryId: string;
  email: string;
  active: boolean;
  createdAt: string;
  // KHÔNG expose unsubscribeToken
}

export function toCategoryDTO(c: CategoryDoc): CategoryDTO {
  return {
    id: c._id!.toString(),
    name: c.name,
    slug: c.slug,
    description: c.description ?? '',
    keywords: c.keywords,
    scope: c.scope,
    topN: c.topN ?? null,
    lang: c.lang ?? null,
    enabled: c.enabled,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toSubscriberDTO(s: SubscriberDoc): SubscriberDTO {
  return {
    id: s._id!.toString(),
    categoryId: s.categoryId.toString(),
    email: s.email,
    active: s.active,
    createdAt: s.createdAt.toISOString(),
  };
}
