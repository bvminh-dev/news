/**
 * T3 — Định nghĩa collections + tài liệu + đảm bảo index.
 * Indexes: dedup (categoryId+normalizedUrl / categoryId+fingerprint+date),
 * idempotency (date+categoryId+step / date+categoryId+email), TTL theo retention.
 */
import { Collection, Db, ObjectId } from 'mongodb';
import { getConfig } from '@/lib/config';
import { getDb } from '@/lib/db';

export type Scope = 'VN' | 'WORLD';
export type RunStep = 'collect' | 'send';
export type RunStatus =
  | 'pending'
  | 'collecting'
  | 'collected'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'partial';
export type DeliveryStatus = 'queued' | 'sent' | 'failed';

export interface CategoryDoc {
  _id?: ObjectId;
  name: string;
  slug: string;
  description?: string;
  keywords: string[];
  scope: Scope[];
  topN?: number;
  lang?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriberDoc {
  _id?: ObjectId;
  categoryId: ObjectId;
  email: string;
  active: boolean;
  unsubscribeToken: string;
  createdAt: Date;
}

export interface NewsItemDoc {
  _id?: ObjectId;
  categoryId: ObjectId;
  date: string; // YYYY-MM-DD (theo TZ cấu hình)
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
  rank: number;
  fingerprint: string;
  algoVersion: string;
  createdAt: Date;
}

export interface DigestRunDoc {
  _id?: ObjectId;
  date: string;
  categoryId: ObjectId;
  step: RunStep;
  status: RunStatus;
  toolsUsed: string[];
  counts: { found: number; selected: number };
  errors: string[];
  startedAt: Date;
  finishedAt?: Date;
}

export interface DeliveryLogDoc {
  _id?: ObjectId;
  date: string;
  categoryId: ObjectId;
  email: string;
  status: DeliveryStatus;
  attempts: number;
  error?: string;
  sentAt?: Date;
}

export interface AdminUserDoc {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface AuditLogDoc {
  _id?: ObjectId;
  actor: string;
  action: string;
  target: string;
  before?: unknown;
  after?: unknown;
  at: Date;
}

export async function collections(db?: Db) {
  const d = db ?? (await getDb());
  return {
    categories: d.collection<CategoryDoc>('categories'),
    subscribers: d.collection<SubscriberDoc>('subscribers'),
    news: d.collection<NewsItemDoc>('news_items'),
    runs: d.collection<DigestRunDoc>('digest_runs'),
    deliveries: d.collection<DeliveryLogDoc>('delivery_logs'),
    admins: d.collection<AdminUserDoc>('admin_users'),
    audits: d.collection<AuditLogDoc>('audit_logs'),
  };
}

let ensured = false;
/** Tạo index (idempotent). Gọi lúc khởi động / trước thao tác ghi lần đầu. */
export async function ensureIndexes(db?: Db): Promise<void> {
  if (ensured) return;
  const cfg = getConfig();
  const c = await collections(db);
  const ttlSeconds = cfg.retentionDays * 24 * 60 * 60;

  await c.categories.createIndex({ name: 1 }, { unique: true });
  await c.categories.createIndex({ slug: 1 }, { unique: true });

  await c.subscribers.createIndex({ categoryId: 1, email: 1 }, { unique: true });
  await c.subscribers.createIndex({ unsubscribeToken: 1 }, { unique: true });

  await c.news.createIndex({ categoryId: 1, normalizedUrl: 1 }, { unique: true });
  await c.news.createIndex({ categoryId: 1, fingerprint: 1, date: 1 });
  await c.news.createIndex({ categoryId: 1, date: 1 });
  await c.news.createIndex({ createdAt: 1 }, { expireAfterSeconds: ttlSeconds });

  await c.runs.createIndex({ date: 1, categoryId: 1, step: 1 }, { unique: true });
  await c.runs.createIndex({ startedAt: 1 }, { expireAfterSeconds: ttlSeconds });

  await c.deliveries.createIndex({ date: 1, categoryId: 1, email: 1 }, { unique: true });
  await c.deliveries.createIndex({ sentAt: 1 }, { expireAfterSeconds: ttlSeconds });

  await c.admins.createIndex({ email: 1 }, { unique: true });

  ensured = true;
}
