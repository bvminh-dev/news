/**
 * T19 — Structured logging. KHÔNG log secret/PII. Chỉ log field an toàn.
 * (Trên Vercel, console.* đi vào log runtime.)
 */
type Level = 'info' | 'warn' | 'error';

function emit(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = { level, event, ...fields };
  const s = JSON.stringify(line);
  if (level === 'error') console.error(s);
  else if (level === 'warn') console.warn(s);
  else console.log(s);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields),
};

/** Mask email cho log (giữ vết mà không lộ đầy đủ PII). */
export function maskEmail(email: string): string {
  const [u, d] = email.split('@');
  if (!d) return '***';
  const head = u.slice(0, 1);
  return `${head}***@${d}`;
}
