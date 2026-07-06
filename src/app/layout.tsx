import type { ReactNode } from 'react';

export const metadata = {
  title: 'Bản tin hàng ngày',
  description: 'Thu thập & gửi bản tin nổi bật theo danh mục',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: 'system-ui, Arial, sans-serif', background: '#f6f7f9' }}>
        {children}
      </body>
    </html>
  );
}
