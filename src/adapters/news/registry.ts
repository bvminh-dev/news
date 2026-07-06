/**
 * T8 — Adapter Registry theo env (tech ADR-04). Thiếu key ⇒ KHÔNG khởi tạo adapter đó.
 * buildActiveAdapters nhận cấu hình tools (thuần) để test được.
 */
import { NewsSourceAdapter } from './types';
import { PerplexityAdapter } from './perplexity';
import { FirecrawlAdapter } from './firecrawl';
import { ApifyAdapter } from './apify';

export interface ToolKeys {
  perplexityKey: string;
  firecrawlKey: string;
  apifyToken: string;
}

export function buildActiveAdapters(tools: ToolKeys): NewsSourceAdapter[] {
  const adapters: NewsSourceAdapter[] = [];
  if (tools.perplexityKey) adapters.push(new PerplexityAdapter(tools.perplexityKey));
  if (tools.firecrawlKey) adapters.push(new FirecrawlAdapter(tools.firecrawlKey));
  if (tools.apifyToken) adapters.push(new ApifyAdapter(tools.apifyToken));
  return adapters;
}
