/**
 * Helper fetch có timeout + retry backoff (dùng chung cho adapter — tech §Integration).
 */
export interface FetchOpts {
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: FetchOpts = {},
): Promise<Response> {
  const { timeoutMs = 20000, retries = 2, backoffMs = 500 } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      clearTimeout(timer);
      // Retry với 429/5xx
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`);
      } else {
        return res;
      }
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, attempt)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetch thất bại');
}
