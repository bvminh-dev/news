/**
 * Seed admin từ ENV vào admin_users (idempotent). Chạy: npm run seed:admin
 * Yêu cầu ADMIN_EMAIL + ADMIN_PASSWORD_HASH (bcrypt) trong env.
 */
import { getConfig, validateConfig } from '../src/lib/config';
import { collections, ensureIndexes } from '../src/models';

async function main() {
  validateConfig();
  const cfg = getConfig();
  await ensureIndexes();
  const c = await collections();
  await c.admins.updateOne(
    { email: cfg.adminEmail.toLowerCase() },
    { $setOnInsert: { email: cfg.adminEmail.toLowerCase(), passwordHash: cfg.adminPasswordHash, createdAt: new Date() } },
    { upsert: true },
  );
  console.log('Seed admin xong:', cfg.adminEmail);
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
