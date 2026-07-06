import { describe, it, expect, beforeEach } from 'vitest';
import { validateConfig, resetConfigCache, getConfig, AppConfig } from '@/lib/config';

function baseEnv() {
  process.env.MONGODB_URI = 'mongodb://x';
  process.env.ADMIN_EMAIL = 'a@b.com';
  process.env.ADMIN_PASSWORD_HASH = 'hash';
  process.env.NEXTAUTH_SECRET = 'secret';
  process.env.CRON_SECRET = 'cron';
  resetConfigCache();
}

describe('UT-15 validateConfig', () => {
  beforeEach(baseEnv);

  it('retention < dedup → throw', () => {
    const cfg: AppConfig = { ...getConfig(), retentionDays: 7, dedupWindowDays: 14 };
    expect(() => validateConfig(cfg)).toThrow(/RETENTION/);
  });
  it('đủ env + ràng buộc hợp lệ → ok', () => {
    const cfg: AppConfig = { ...getConfig(), retentionDays: 30, dedupWindowDays: 14 };
    expect(() => validateConfig(cfg)).not.toThrow();
  });
  it('thiếu MONGODB_URI → throw, không lộ giá trị', () => {
    const cfg: AppConfig = { ...getConfig(), mongoUri: '' };
    expect(() => validateConfig(cfg)).toThrow(/MONGODB_URI/);
  });
});
