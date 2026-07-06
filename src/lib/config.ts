/**
 * T2 — Config/env loader (không hardcode).
 * - Đọc cấu hình từ ENV, ép kiểu, đặt mặc định an toàn.
 * - validateConfig() fail-fast: báo THIẾU biến bắt buộc + ràng buộc nghiệp vụ,
 *   KHÔNG in giá trị secret (security.md §Secret Management).
 * - Ràng buộc: NEWS_RETENTION_DAYS >= DEDUP_WINDOW_DAYS (tech ADR-07).
 */

function num(name: string, def: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Cấu hình sai: ${name} phải là số`);
  return n;
}

function str(name: string, def = ''): string {
  return process.env[name] ?? def;
}

function bool(name: string, def: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return def;
  return raw === 'true' || raw === '1';
}

export interface AppConfig {
  mongoUri: string;
  mongoDb: string;
  adminEmail: string;
  adminPasswordHash: string;
  nextAuthSecret: string;
  cronSecret: string;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
    alertTo: string;
  };
  tools: {
    perplexityKey: string;
    firecrawlKey: string;
    apifyToken: string;
  };
  queue: {
    qstashToken: string;
    qstashCurrentKey: string;
    qstashNextKey: string;
  };
  tz: string;
  lang: string;
  defaultTopN: number;
  dedupWindowDays: number;
  retentionDays: number;
  weightRelevance: number;
  weightEngagement: number;
  publicBaseUrl: string;
}

let cached: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cached) return cached;
  cached = {
    mongoUri: str('MONGODB_URI'),
    mongoDb: str('MONGODB_DB', 'ban_tin'),
    adminEmail: str('ADMIN_EMAIL'),
    adminPasswordHash: str('ADMIN_PASSWORD_HASH'),
    nextAuthSecret: str('NEXTAUTH_SECRET'),
    cronSecret: str('CRON_SECRET'),
    smtp: {
      host: str('SMTP_HOST', 'smtp.gmail.com'),
      port: num('SMTP_PORT', 465),
      secure: bool('SMTP_SECURE', true),
      user: str('SMTP_USER'),
      password: str('SMTP_PASSWORD'),
      from: str('MAIL_FROM'),
      alertTo: str('ADMIN_ALERT_EMAIL'),
    },
    tools: {
      perplexityKey: str('PERPLEXITY_API_KEY'),
      firecrawlKey: str('FIRECRAWL_API_KEY'),
      apifyToken: str('APIFY_TOKEN'),
    },
    queue: {
      qstashToken: str('QSTASH_TOKEN'),
      qstashCurrentKey: str('QSTASH_CURRENT_SIGNING_KEY'),
      qstashNextKey: str('QSTASH_NEXT_SIGNING_KEY'),
    },
    tz: str('APP_TZ', 'Asia/Ho_Chi_Minh'),
    lang: str('APP_LANG', 'vi'),
    defaultTopN: num('DEFAULT_TOP_N', 10),
    dedupWindowDays: num('DEDUP_WINDOW_DAYS', 14),
    retentionDays: num('NEWS_RETENTION_DAYS', 30),
    weightRelevance: num('RANK_WEIGHT_RELEVANCE', 0.6),
    weightEngagement: num('RANK_WEIGHT_ENGAGEMENT', 0.4),
    publicBaseUrl: str('PUBLIC_BASE_URL', 'http://localhost:3000'),
  };
  return cached;
}

/** Dùng cho test để nạp lại config sau khi đổi env. */
export function resetConfigCache(): void {
  cached = null;
}

/**
 * validateConfig — fail-fast. Trả về danh sách LỖI (không chứa giá trị secret).
 * Ném lỗi nếu thiếu biến bắt buộc hoặc vi phạm ràng buộc. Adapter thu thập KHÔNG bắt buộc.
 */
export function validateConfig(cfg: AppConfig = getConfig()): void {
  const missing: string[] = [];
  if (!cfg.mongoUri) missing.push('MONGODB_URI');
  if (!cfg.adminEmail) missing.push('ADMIN_EMAIL');
  if (!cfg.adminPasswordHash) missing.push('ADMIN_PASSWORD_HASH');
  if (!cfg.nextAuthSecret) missing.push('NEXTAUTH_SECRET');
  if (!cfg.cronSecret) missing.push('CRON_SECRET');

  const errors: string[] = [];
  if (missing.length) errors.push(`Thiếu biến môi trường bắt buộc: ${missing.join(', ')}`);
  if (cfg.retentionDays < cfg.dedupWindowDays) {
    errors.push('NEWS_RETENTION_DAYS phải >= DEDUP_WINDOW_DAYS (nếu không dedup sẽ mất dữ liệu đối chiếu)');
  }
  if (cfg.defaultTopN < 1 || cfg.defaultTopN > 50) {
    errors.push('DEFAULT_TOP_N phải trong khoảng [1..50]');
  }
  if (cfg.weightRelevance < 0 || cfg.weightEngagement < 0) {
    errors.push('Trọng số ranking không được âm');
  }

  if (errors.length) {
    // KHÔNG in giá trị secret — chỉ tên biến & thông điệp.
    throw new Error(`Cấu hình không hợp lệ:\n- ${errors.join('\n- ')}`);
  }
}

/** Cấu hình gửi email đã sẵn sàng chưa (không throw). */
export function isMailConfigured(cfg: AppConfig = getConfig()): boolean {
  return Boolean(cfg.smtp.host && cfg.smtp.user && cfg.smtp.password && cfg.smtp.from);
}
