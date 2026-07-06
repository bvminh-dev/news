/**
 * T6 — Cửa sổ 24h. So sánh theo UTC (chuẩn hóa mọi publishedAt về UTC trước khi so).
 * windowFrom/windowTo tính từ thời điểm run (truyền vào, KHÔNG dùng Date.now trong hàm thuần).
 */

export function isInWindow24h(publishedAt: Date | null, windowFrom: Date, windowTo: Date): boolean {
  if (!publishedAt) return false;
  const t = publishedAt.getTime();
  return t >= windowFrom.getTime() && t <= windowTo.getTime();
}

/** Tạo cửa sổ [runTime-24h, runTime]. runTime truyền vào để test được. */
export function makeWindow(runTime: Date): { windowFrom: Date; windowTo: Date } {
  const windowTo = runTime;
  const windowFrom = new Date(runTime.getTime() - 24 * 60 * 60 * 1000);
  return { windowFrom, windowTo };
}
