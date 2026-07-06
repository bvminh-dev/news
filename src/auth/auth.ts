/**
 * T13 — Auth admin (NextAuth v5 Credentials). Admin seed từ env vào admin_users.
 * Cookie HttpOnly/Secure/SameSite (mặc định của NextAuth trên HTTPS).
 */
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getConfig } from '@/lib/config';
import { collections, ensureIndexes } from '@/models';
import { emailSchema } from '@/domain/schemas';
import { log } from '@/lib/logger';
import { rateLimit } from '@/lib/rateLimit';

async function ensureAdminSeeded(): Promise<void> {
  const cfg = getConfig();
  if (!cfg.adminEmail || !cfg.adminPasswordHash) return;
  await ensureIndexes();
  const c = await collections();
  await c.admins.updateOne(
    { email: cfg.adminEmail.toLowerCase() },
    {
      $setOnInsert: {
        email: cfg.adminEmail.toLowerCase(),
        passwordHash: cfg.adminPasswordHash,
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: getConfig().nextAuthSecret,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        // BUG-3: rate-limit/lockout login theo IP (chống brute-force/credential-stuffing).
        const fwd = request?.headers?.get?.('x-forwarded-for') ?? '';
        const ip = fwd.split(',')[0].trim() || 'unknown';
        if (!rateLimit(`login:${ip}`, 5, 5 * 60_000)) {
          log.warn('auth.login_rate_limited', { });
          return null;
        }
        const emailParsed = emailSchema.safeParse(raw?.email);
        const password = typeof raw?.password === 'string' ? raw.password : '';
        if (!emailParsed.success || !password) return null;
        await ensureAdminSeeded();
        const c = await collections();
        const admin = await c.admins.findOne({ email: emailParsed.data });
        if (!admin) {
          log.warn('auth.login_failed', { reason: 'no-user' });
          return null;
        }
        const ok = await bcrypt.compare(password, admin.passwordHash);
        if (!ok) {
          log.warn('auth.login_failed', { reason: 'bad-password' });
          return null;
        }
        log.info('auth.login_success', {});
        return { id: admin._id!.toString(), email: admin.email, role: 'admin' };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = 'admin';
      return token;
    },
    session({ session, token }) {
      if (session.user) (session.user as { role?: string }).role = token.role as string;
      return session;
    },
  },
});
