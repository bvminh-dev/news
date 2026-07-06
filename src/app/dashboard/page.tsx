import { redirect } from 'next/navigation';
import { auth, signOut } from '@/auth/auth';
import CategoryManager from './CategoryManager';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== 'admin') redirect('/login');

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22 }}>Bản tin hàng ngày — Quản trị</h1>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/login' });
          }}
        >
          <button data-testid="logout-btn" type="submit" style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' }}>
            Đăng xuất
          </button>
        </form>
      </header>
      <CategoryManager />
    </main>
  );
}
