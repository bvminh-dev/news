/**
 * FT (DB-backed) — chứng minh fix BUG-1 (không xung đột createdAt khi upsert) và
 * BUG-2 (khóa gồm date → giữ lịch sử, idempotent trong-ngày). Dùng mongodb-memory-server.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ObjectId } from 'mongodb';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = 'test_ban_tin';
  process.env.ADMIN_EMAIL = 'a@b.com';
  process.env.ADMIN_PASSWORD_HASH = 'x';
  process.env.NEXTAUTH_SECRET = 's';
  process.env.CRON_SECRET = 'c';
  const { resetConfigCache } = await import('@/lib/config');
  resetConfigCache();
}, 60000);

afterAll(async () => {
  if (mongod) await mongod.stop();
});

function newsUpsert(catId: ObjectId, date: string, normalizedUrl: string, rank: number) {
  // Cùng shape upsert như services/collect.ts (sau fix).
  return {
    filter: { categoryId: catId, date, normalizedUrl },
    update: {
      $set: {
        categoryId: catId,
        date,
        title: 't',
        url: normalizedUrl,
        normalizedUrl,
        platform: 'web',
        sourceAdapters: ['perplexity'],
        publishedAt: null,
        summary: '',
        rawEngagement: {},
        engagementScore: 0,
        relevanceScore: 0.5,
        finalScore: 0.3,
        rank,
        fingerprint: 't',
        algoVersion: 'rank-v1-minmax',
      },
      $setOnInsert: { createdAt: new Date('2026-07-06T00:00:00Z') },
    },
    opts: { upsert: true as const },
  };
}

describe('FT-DB collect upsert (fix BUG-1 & BUG-2)', () => {
  it('BUG-1: upsert không ném lỗi conflict createdAt', async () => {
    const { collections, ensureIndexes } = await import('@/models');
    await ensureIndexes();
    const c = await collections();
    const catId = new ObjectId();
    const u = newsUpsert(catId, '2026-07-06', 'https://a.com/x', 1);
    await expect(c.news.updateOne(u.filter, u.update, u.opts)).resolves.toBeTruthy();
  });

  it('BUG-1: rerun cùng (cat,date,url) → idempotent 1 doc', async () => {
    const { collections } = await import('@/models');
    const c = await collections();
    const catId = new ObjectId();
    const u1 = newsUpsert(catId, '2026-07-06', 'https://b.com/y', 1);
    await c.news.updateOne(u1.filter, u1.update, u1.opts);
    const u2 = newsUpsert(catId, '2026-07-06', 'https://b.com/y', 2); // rerun, rank khác
    await c.news.updateOne(u2.filter, u2.update, u2.opts);
    const count = await c.news.countDocuments({ categoryId: catId, normalizedUrl: 'https://b.com/y' });
    expect(count).toBe(1);
  });

  it('BUG-2: cùng url khác date → 2 doc (giữ lịch sử, không đè)', async () => {
    const { collections } = await import('@/models');
    const c = await collections();
    const catId = new ObjectId();
    const d1 = newsUpsert(catId, '2026-07-01', 'https://c.com/z', 1);
    await c.news.updateOne(d1.filter, d1.update, d1.opts);
    const d2 = newsUpsert(catId, '2026-07-16', 'https://c.com/z', 1); // tái xuất sau dedup-window
    await c.news.updateOne(d2.filter, d2.update, d2.opts);
    const docs = await c.news.find({ categoryId: catId, normalizedUrl: 'https://c.com/z' }).toArray();
    expect(docs).toHaveLength(2);
    expect(docs.map((d) => d.date).sort()).toEqual(['2026-07-01', '2026-07-16']);
  });
});
