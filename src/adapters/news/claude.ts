/**
 * T8 — Claude adapter (thay Perplexity).
 *
 * Thay vì gọi thẳng Anthropic Messages API qua SDK (token subscription sk-ant-oat
 * bị 429 rate_limit_error), adapter SPAWN `claude` CLI ở chế độ headless (`-p`) và
 * bơm credential qua ENV để chính CLI gọi lên Anthropic — CLI biết cách xác thực
 * subscription OAuth token. CLI dùng công cụ WebSearch của nó để tìm tin NỔI BẬT
 * 24h, tóm tắt và chấm relevance, rồi in JSON array ra stdout.
 *
 * Phân loại credential theo tiền tố (HUONG-DAN-PER-PROJECT-CLAUDE-KEY §5):
 *   - sk-ant-api… (Console API key)     → ENV ANTHROPIC_API_KEY      (+ cờ --bare)
 *   - sk-ant-oat… (OAuth/subscription)  → ENV CLAUDE_CODE_OAUTH_TOKEN
 * Truyền nhầm ENV → "Invalid API key" / "401 Invalid bearer token".
 *
 * Cô lập: mỗi lần chạy dùng CLAUDE_CONFIG_DIR tạm riêng + xoá mọi ENV auth kế thừa
 * → CLI không "mượn" tài khoản của máy host. Prompt untrusted truyền qua stdin.
 */
import { spawn } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { CollectionQuery, RawNewsItem } from '@/domain/types';
import { sanitizeContent } from '@/domain/sanitize';
import { NewsSourceAdapter } from './types';

const DEFAULT_TIMEOUT_MS = 180_000;

export class ClaudeAdapter implements NewsSourceAdapter {
  readonly name = 'claude';

  constructor(
    private credential: string,
    private model: string = 'claude-opus-4-8',
  ) {}

  async search(query: CollectionQuery): Promise<RawNewsItem[]> {
    const scopeText = query.scope.join(' + ');
    const prompt =
      `Dùng công cụ web search tìm tối đa ${query.topN} tin tức NỔI BẬT trong 24 giờ qua ` +
      `về chủ đề: ${query.keywords.join(', ')} (phạm vi: ${scopeText}). ` +
      `Sau khi tìm, chỉ IN RA DUY NHẤT một JSON array (không kèm giải thích, không markdown), ` +
      `mỗi phần tử: {"title","url","publishedAt"(ISO 8601 nếu biết),"summary","relevance"(0..1)}. ` +
      `Ngôn ngữ tóm tắt: ${query.lang}.`;

    const { ok, stdout, error } = await runClaudeCli(this.credential, this.model, prompt);
    if (!ok) throw new Error(error ?? 'claude-cli-failed');
    return parseItems(stdout);
  }
}

interface CliResult {
  ok: boolean;
  stdout: string;
  error?: string;
}

/** Spawn `claude -p` với credential bơm qua ENV; prompt qua stdin; text ra stdout. */
async function runClaudeCli(credential: string, model: string, prompt: string): Promise<CliResult> {
  // (1) trim: tránh \n/space khi nhập/giải mã làm hỏng key.
  const token = credential.trim();

  // (2) phân loại credential theo tiền tố → 2 ENV khác nhau.
  const isOAuth = token.startsWith('sk-ant-oat');

  // (3) cô lập khỏi tài khoản máy host: config dir tạm riêng theo lần chạy.
  const cfgDir = await mkdtemp(join(tmpdir(), 'claude-news-'));

  // --permission-mode plan = chỉ-đọc (WebSearch/WebFetch được phép; chặn ghi) →
  //   an toàn với nội dung untrusted + không treo chờ phê duyệt trong headless.
  // --bare = bỏ qua OAuth/keychain máy, ép dùng ANTHROPIC_API_KEY. CHỈ cho Console key.
  const args = ['-p', '--model', model, '--permission-mode', 'plan'];
  if (!isOAuth) args.push('--bare');

  // (4) ENV xác định: xoá mọi biến auth kế thừa rồi set ĐÚNG 1 loại (tránh
  //     ANTHROPIC_API_KEY lấn át OAuth token hoặc ngược lại).
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.CLAUDE_CODE_OAUTH_TOKEN;
  if (isOAuth) env.CLAUDE_CODE_OAUTH_TOKEN = token;
  else env.ANTHROPIC_API_KEY = token;
  env.CLAUDE_CONFIG_DIR = cfgDir;

  const timeoutMs = Number(process.env.CLAUDE_CLI_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  try {
    return await new Promise<CliResult>((resolve) => {
      const child = spawn(process.env.CLAUDE_CLI_BIN ?? 'claude', args, {
        // Windows: bin là claude.cmd → shell:false ném ENOENT. Bật shell CHỈ trên win32.
        // An toàn: mọi arg cố định; prompt untrusted đi qua stdin (không qua arg/shell).
        shell: process.platform === 'win32',
        env,
      });

      let stdout = '';
      let stderr = '';
      let settled = false;
      const done = (r: CliResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(r);
      };
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        done({ ok: false, stdout, error: 'timeout' });
      }, timeoutMs);

      child.stdout.on('data', (d) => (stdout += d.toString()));
      child.stderr.on('data', (d) => (stderr += d.toString()));
      child.on('error', () => done({ ok: false, stdout, error: 'không chạy được claude CLI' }));
      child.on('close', (code) => {
        if (code !== 0) {
          // (5) CLI ở chế độ -p ghi LỖI ra STDOUT (không phải stderr) rồi exit≠0.
          //     Gộp cả 2 stream kẻo bỏ sót nguyên nhân.
          const combined = `${stdout}\n${stderr}`.trim();
          const isAuth = /invalid api key|invalid bearer|authentication|unauthorized|401/i.test(combined);
          const isQuota = /credit balance|insufficient|quota|rate limit|rate_limit|429/i.test(combined);
          const error = isAuth
            ? 'Claude credential không hợp lệ/hết hạn — cập nhật lại key/token.'
            : isQuota
              ? 'Claude hết credit hoặc bị rate-limit.'
              : `claude CLI exit ${code}`;
          done({ ok: false, stdout, error });
          return;
        }
        done({ ok: true, stdout });
      });

      // (6) prompt qua STDIN, không qua arg (chống lộ qua ps/log + chống injection).
      child.stdin.write(prompt);
      child.stdin.end();
    });
  } finally {
    // (7) dọn config dir tạm KỂ CẢ khi lỗi/timeout.
    await rm(cfgDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function parseItems(content: string): RawNewsItem[] {
  const arr = extractJsonArray(content);
  if (!Array.isArray(arr)) return [];
  const out: RawNewsItem[] = [];
  for (const raw of arr) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.url !== 'string' || typeof r.title !== 'string') continue;
    const published = typeof r.publishedAt === 'string' ? new Date(r.publishedAt) : null;
    out.push({
      title: sanitizeContent(r.title),
      url: r.url,
      platform: 'web',
      publishedAt: published && !isNaN(published.getTime()) ? published : null,
      summary: typeof r.summary === 'string' ? sanitizeContent(r.summary) : '',
      rawEngagement: {},
      relevance: typeof r.relevance === 'number' ? clamp01(r.relevance) : undefined,
      sourceAdapter: 'claude',
    });
  }
  return out;
}

/**
 * Quét JSON array cân bằng ngoặc (tránh regex tham lam bắt nhầm prose/markdown).
 * Thử từng vị trí '[' cho tới khi JSON.parse thành công và ra Array.
 */
function extractJsonArray(text: string): unknown[] | null {
  for (let start = text.indexOf('['); start >= 0; start = text.indexOf('[', start + 1)) {
    const slice = balancedSlice(text, start);
    if (!slice) continue;
    try {
      const parsed = JSON.parse(slice);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // thử vị trí '[' kế tiếp
    }
  }
  return null;
}

/** Trả về đoạn từ `start` (ký tự '[') tới ']' cân bằng, tôn trọng chuỗi. */
function balancedSlice(text: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
