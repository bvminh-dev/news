/**
 * T3 — Kết nối MongoDB (TLS mặc định bởi Atlas), tái dùng client giữa các invocation
 * serverless (cache trên globalThis để tránh mở kết nối tràn lan).
 */
import { MongoClient, Db } from 'mongodb';
import { getConfig } from './config';

interface GlobalWithMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}
const g = globalThis as unknown as GlobalWithMongo;

function clientPromise(): Promise<MongoClient> {
  const cfg = getConfig();
  if (!cfg.mongoUri) throw new Error('MONGODB_URI chưa cấu hình');
  if (!g._mongoClientPromise) {
    const client = new MongoClient(cfg.mongoUri, { maxPoolSize: 10 });
    g._mongoClientPromise = client.connect();
  }
  return g._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const cfg = getConfig();
  const client = await clientPromise();
  return client.db(cfg.mongoDb);
}
