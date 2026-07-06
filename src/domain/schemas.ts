/**
 * T4 — Zod schemas (validation lõi). Chống NoSQL injection: mọi input từ client
 * phải qua schema strict; object/operator ($ne, $gt...) không khớp string ⇒ bị từ chối.
 */
import { z } from 'zod';

export const scopeSchema = z.enum(['VN', 'WORLD']);

// Email: bắt buộc string hợp lệ. Nếu client gửi object {$ne:null} → parse fail.
export const emailSchema = z
  .string({ invalid_type_error: 'Email phải là chuỗi' })
  .trim()
  .toLowerCase()
  .email('Email không hợp lệ')
  .max(254);

export const topNSchema = z
  .number({ invalid_type_error: 'topN phải là số' })
  .int('topN phải là số nguyên')
  .min(1, 'topN tối thiểu 1')
  .max(50, 'topN tối đa 50');

export const keywordsSchema = z
  .array(z.string().trim().min(1).max(100))
  .min(1, 'Cần ít nhất 1 từ khóa')
  .max(20, 'Tối đa 20 từ khóa');

export const categoryNameSchema = z.string().trim().min(1, 'Tên danh mục bắt buộc').max(120);

export const createCategorySchema = z.object({
  name: categoryNameSchema,
  description: z.string().trim().max(500).optional().default(''),
  keywords: keywordsSchema,
  scope: z.array(scopeSchema).min(1, 'Cần ít nhất 1 phạm vi'),
  topN: topNSchema.optional(),
  lang: z.string().trim().max(10).optional(),
  enabled: z.boolean().optional().default(true),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

// partial cho update (PATCH) — vẫn strict kiểu từng field.
export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const addSubscriberSchema = z.object({
  email: emailSchema,
});

// Tham số route worker/collect|send
export const workerJobSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date phải dạng YYYY-MM-DD'),
  categoryId: z.string().regex(/^[a-f0-9]{24}$/i, 'categoryId không hợp lệ'),
});
export type WorkerJob = z.infer<typeof workerJobSchema>;

// Token unsubscribe: hex string, không nhận object.
export const unsubscribeTokenSchema = z.string().regex(/^[a-f0-9]{32,}$/i, 'token không hợp lệ');
