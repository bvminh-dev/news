import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * T18 — Defense-in-depth: chặn trang admin (/dashboard) nếu chưa có session cookie.
 * Kiểm tra quyền chi tiết vẫn nằm ở route handler (requireAdmin) + trang (auth()).
 * Cron/worker/public/auth/login KHÔNG qua guard này.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = pathname === '/' || pathname.startsWith('/dashboard');
  if (!isProtected) return NextResponse.next();

  // Cookie session của NextAuth (v5): authjs.session-token / __Secure-authjs.session-token
  const hasSession =
    req.cookies.has('authjs.session-token') || req.cookies.has('__Secure-authjs.session-token');
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
};
