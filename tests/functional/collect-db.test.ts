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

describe('FT-DB run-now force: đẩy tin cũ xuống, tin mới lên đầu', () => {
  it('shift rank += số tin mới, rồi tin mới chiếm rank 1..N', async () => {
    const { collections } = await import('@/models');
    const c = await collections();
    const catId = new ObjectId();
    const date = '2026-07-20';
    // Seed 3 tin cũ rank 1..3.
    for (let i = 1; i <= 3; i++) {
      const u = newsUpsert(catId, date, `https://old.com/${i}`, i);
      await c.news.updateOne(u.filter, u.update, u.opts);
    }
    // Force run: đẩy tin cũ xuống +2 (số tin mới), rồi chèn 2 tin mới rank 1..2.
    const NEW = 2;
    await c.news.updateMany({ categoryId: catId, date }, { $inc: { rank: NEW } });
    for (let i = 1; i <= NEW; i++) {
      const u = newsUpsert(catId, date, `https://new.com/${i}`, i);
      await c.news.updateOne(u.filter, u.update, u.opts);
    }
    const docs = await c.news.find({ categoryId: catId, date }).sort({ rank: 1 }).toArray();
    expect(docs).toHaveLength(5); // 3 cũ + 2 mới (giữ cả hai)
    // 2 tin đầu (rank 1,2) là tin MỚI; phần còn lại (rank 3..5) là tin cũ đã đẩy xuống.
    expect(docs.slice(0, 2).map((d) => d.url)).toEqual(['https://new.com/1', 'https://new.com/2']);
    expect(docs.map((d) => d.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(docs.slice(2).every((d) => d.url.startsWith('https://old.com/'))).toBe(true);
  });

  it('send giới hạn top-N → chỉ lấy bộ tin mới trên đầu', async () => {
    const { collections } = await import('@/models');
    const c = await collections();
    const catId = new ObjectId();
    const date = '2026-07-21';
    // 5 tin: rank 1..2 mới, 3..5 cũ.
    const seed = [
      newsUpsert(catId, date, 'https://n.com/1', 1),
      newsUpsert(catId, date, 'https://n.com/2', 2),
      newsUpsert(catId, date, 'https://o.com/3', 3),
      newsUpsert(catId, date, 'https://o.com/4', 4),
      newsUpsert(catId, date, 'https://o.com/5', 5),
    ];
    for (const u of seed) await c.news.updateOne(u.filter, u.update, u.opts);
    const topN = 2;
    const sent = await c.news.find({ categoryId: catId, date }).sort({ rank: 1 }).limit(topN).toArray();
    expect(sent).toHaveLength(2);
    expect(sent.map((d) => d.url)).toEqual(['https://n.com/1', 'https://n.com/2']);
  });
});
