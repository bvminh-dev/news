import { requireAdmin, json } from '@/lib/guard';
import { collections, ensureIndexes } from '@/models';

export const dynamic = 'force-dynamic';

// GET các run gần đây (cho trang Runs/Logs).
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  await ensureIndexes();
  const c = await collections();
  const rows = await c.runs.find({}).sort({ startedAt: -1 }).limit(100).toArray();
  return json(200, {
    runs: rows.map((r) => ({
      date: r.date,
      categoryId: r.categoryId.toString(),
      step: r.step,
      status: r.status,
      toolsUsed: r.toolsUsed,
      counts: r.counts,
      errors: r.errors,
    })),
  });
}
