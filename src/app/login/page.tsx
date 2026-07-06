'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError('Đăng nhập thất bại. Kiểm tra lại thông tin.'); // generic — không lộ email tồn tại
    } else {
      window.location.href = '/dashboard';
    }
  }

  return (
    <div style={{ maxWidth: 380, margin: '80px auto', background: '#fff', padding: 28, borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
      <h1 style={{ fontSize: 20 }}>Đăng nhập quản trị</h1>
      <form onSubmit={onSubmit}>
        <label style={{ display: 'block', fontSize: 13, marginTop: 12 }}>Email</label>
        <input
          data-testid="login-email-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
          autoComplete="username"
        />
        <label style={{ display: 'block', fontSize: 13, marginTop: 12 }}>Mật khẩu</label>
        <input
          data-testid="login-password-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          autoComplete="current-password"
        />
        {error && (
          <p data-testid="login-error-msg" style={{ color: '#c0392b', fontSize: 13 }}>
            {error}
          </p>
        )}
        <button data-testid="login-submit-btn" type="submit" disabled={loading} style={btnStyle}>
          {loading ? 'Đang xử lý…' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: 9, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box' };
const btnStyle: React.CSSProperties = { marginTop: 18, width: '100%', padding: 10, borderRadius: 6, border: 0, background: '#2563eb', color: '#fff', cursor: 'pointer' };
