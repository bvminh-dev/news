/**
 * T8 — Adapter Registry theo env (tech ADR-04). Thiếu key ⇒ KHÔNG khởi tạo adapter đó.
 * buildActiveAdapters nhận cấu hình tools (thuần) để test được.
 */
import { NewsSourceAdapter } from './types';
import { ClaudeAdapter } from './claude';
import { FirecrawlAdapter } from './firecrawl';
import { ApifyAdapter } from './apify';

export interface ToolKeys {
  anthropicKey: string;
  /** OAuth token Claude Code (sk-ant-oat...) — ưu tiên hơn anthropicKey nếu có. */
  anthropicAuthToken?: string;
  claudeModel: string;
  firecrawlKey: string;
  apifyToken: string;
}

export function buildActiveAdapters(tools: ToolKeys): NewsSourceAdapter[] {
  const adapters: NewsSourceAdapter[] = [];
  // Ưu tiên OAuth token nếu được cấu hình; nếu không thì dùng API key.
  // ClaudeAdapter tự nhận diện sk-ant-oat... để gửi Bearer + beta header.
  const claudeCredential = tools.anthropicAuthToken || tools.anthropicKey;
  if (claudeCredential) adapters.push(new ClaudeAdapter(claudeCredential, tools.claudeModel));
  if (tools.firecrawlKey) adapters.push(new FirecrawlAdapter(tools.firecrawlKey));
  if (tools.apifyToken) adapters.push(new ApifyAdapter(tools.apifyToken));
  return adapters;
}
