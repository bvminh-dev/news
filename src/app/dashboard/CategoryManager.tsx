'use client';
import { useCallback, useEffect, useState } from 'react';

interface Category {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  scope: string[];
  topN: number | null;
  enabled: boolean;
}
interface Subscriber {
  id: string;
  email: string;
  active: boolean;
}
interface Run {
  date: string;
  categoryId: string;
  step: string;
  status: string;
  counts: { found: number; selected: number };
}

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, r] = await Promise.all([api('/api/admin/categories', 'GET'), api('/api/admin/runs', 'GET')]);
    if (c.ok) setCategories(c.data.categories);
    if (r.ok) setRuns(r.data.runs);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveCategory(form: CategoryForm) {
    setFormError('');
    const payload = {
      name: form.name,
      description: form.description,
      keywords: form.keywords.split(',').map((s) => s.trim()).filter(Boolean),
      scope: form.scope,
      topN: form.topN ? Number(form.topN) : undefined,
      enabled: form.enabled,
    };
    const res = editing
      ? await api(`/api/admin/categories/${editing.id}`, 'PATCH', payload)
      : await api('/api/admin/categories', 'POST', payload);
    if (!res.ok) {
      setFormError(res.data.error ?? 'Lỗi lưu');
      return;
    }
    setShowForm(false);
    setEditing(null);
    await load();
  }

  async function confirmRemove() {
    if (!pendingDelete) return;
    await api(`/api/admin/categories/${pendingDelete}`, 'DELETE');
    setPendingDelete(null);
    await load();
  }

  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 18 }}>Danh mục</h2>
        <button
          data-testid="category-add-btn"
          onClick={() => {
            setEditing(null);
            setShowForm(true);
            setFormError('');
          }}
          style={primaryBtn}
        >
          + Thêm danh mục
        </button>
      </div>

      {showForm && (
        <CategoryFormView
          initial={editing}
          error={formError}
          onCancel={() => setShowForm(false)}
          onSave={saveCategory}
        />
      )}

      <div style={{ marginTop: 12 }}>
        {categories.map((cat) => (
          <div key={cat.id} data-testid={`category-row-${cat.id}`} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{cat.name}</strong> {cat.enabled ? '' : '(tắt)'}
                <div style={{ color: '#666', fontSize: 13 }}>
                  {cat.keywords.join(', ')} · {cat.scope.join('/')} · topN={cat.topN ?? 'mặc định'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button data-testid={`category-edit-btn-${cat.id}`} onClick={() => { setEditing(cat); setShowForm(true); }} style={smallBtn}>Sửa</button>
                <button data-testid={`category-delete-btn-${cat.id}`} onClick={() => setPendingDelete(cat.id)} style={dangerBtn}>Xóa</button>
                <button data-testid={`run-now-btn-${cat.id}`} onClick={() => api('/api/admin/run-now', 'POST', { categoryId: cat.id }).then(load)} style={smallBtn}>Chạy ngay</button>
                <button data-testid={`digest-preview-btn-${cat.id}`} onClick={() => setOpenCat(openCat === cat.id ? null : cat.id)} style={smallBtn}>Xem trước</button>
              </div>
            </div>
            {openCat === cat.id && <Preview categoryId={cat.id} />}
            <SubscriberPanel categoryId={cat.id} />
          </div>
        ))}
      </div>

      <RunsTable runs={runs} />

      {pendingDelete && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <p>Xóa danh mục này? Toàn bộ email &amp; tin liên quan cũng bị xóa.</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPendingDelete(null)} style={smallBtn}>Hủy</button>
              <button data-testid="confirm-delete-btn" onClick={confirmRemove} style={dangerBtn}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface CategoryForm {
  name: string;
  description: string;
  keywords: string;
  scope: string[];
  topN: string;
  enabled: boolean;
}

function CategoryFormView({
  initial,
  error,
  onCancel,
  onSave,
}: {
  initial: Category | null;
  error: string;
  onCancel: () => void;
  onSave: (f: CategoryForm) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [keywords, setKeywords] = useState(initial?.keywords.join(', ') ?? '');
  const [scope, setScope] = useState<string[]>(initial?.scope ?? ['VN', 'WORLD']);
  const [topN, setTopN] = useState(initial?.topN ? String(initial.topN) : '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);

  function toggleScope(s: string) {
    setScope((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <div style={{ ...card, background: '#fafbff' }}>
      <label style={lbl}>Tên danh mục</label>
      <input data-testid="category-name-input" value={name} onChange={(e) => setName(e.target.value)} style={inp} />
      <label style={lbl}>Mô tả</label>
      <input value={description} onChange={(e) => setDescription(e.target.value)} style={inp} />
      <label style={lbl}>Từ khóa (phân tách bằng dấu phẩy)</label>
      <input data-testid="category-keywords-input" value={keywords} onChange={(e) => setKeywords(e.target.value)} style={inp} />
      <label style={lbl}>Phạm vi</label>
      <div data-testid="category-scope-select" style={{ display: 'flex', gap: 12 }}>
        {['VN', 'WORLD'].map((s) => (
          <label key={s} style={{ fontSize: 14 }}>
            <input type="checkbox" checked={scope.includes(s)} onChange={() => toggleScope(s)} /> {s}
          </label>
        ))}
      </div>
      <label style={lbl}>Top N (để trống = mặc định)</label>
      <input data-testid="category-topn-input" type="number" value={topN} onChange={(e) => setTopN(e.target.value)} style={inp} />
      <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input data-testid="category-enabled-toggle" type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Kích hoạt
      </label>
      {error && <p data-testid="category-form-error" style={{ color: '#c0392b', fontSize: 13 }}>{error}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button data-testid="category-save-btn" onClick={() => onSave({ name, description, keywords, scope, topN, enabled })} style={primaryBtn}>Lưu</button>
        <button onClick={onCancel} style={smallBtn}>Hủy</button>
      </div>
    </div>
  );
}

function SubscriberPanel({ categoryId }: { categoryId: string }) {
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await api(`/api/admin/categories/${categoryId}/subscribers`, 'GET');
    if (res.ok) setSubs(res.data.subscribers);
  }, [categoryId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    setError('');
    const res = await api(`/api/admin/categories/${categoryId}/subscribers`, 'POST', { email });
    if (!res.ok) { setError(res.data.error ?? 'Lỗi'); return; }
    setEmail('');
    await load();
  }
  async function del(sid: string) {
    await api(`/api/admin/categories/${categoryId}/subscribers/${sid}`, 'DELETE');
    await load();
  }

  return (
    <div data-testid={`subscriber-panel-${categoryId}`} style={{ marginTop: 10, borderTop: '1px dashed #ddd', paddingTop: 10 }}>
      <div style={{ fontSize: 13, color: '#444', marginBottom: 6 }}>Email người nhận</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input data-testid="subscriber-email-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@vd.com" style={{ ...inp, marginTop: 0 }} />
        <button data-testid="subscriber-add-btn" onClick={add} style={smallBtn}>Thêm</button>
      </div>
      {error && <p data-testid="subscriber-error-msg" style={{ color: '#c0392b', fontSize: 13 }}>{error}</p>}
      <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
        {subs.map((s) => (
          <li key={s.id} data-testid={`subscriber-row-${s.id}`} style={{ fontSize: 14 }}>
            {s.email} {s.active ? '' : '(đã hủy)'}
            <button data-testid={`subscriber-delete-btn-${s.id}`} onClick={() => del(s.id)} style={{ ...dangerBtn, marginLeft: 8 }}>x</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Preview({ categoryId }: { categoryId: string }) {
  const [items, setItems] = useState<{ rank: number; title: string; url: string; summary: string }[]>([]);
  useEffect(() => {
    api(`/api/admin/categories/${categoryId}/preview`, 'GET').then((r) => r.ok && setItems(r.data.items));
  }, [categoryId]);
  return (
    <div data-testid="digest-preview-content" style={{ marginTop: 10, background: '#fff', border: '1px solid #eee', padding: 10, borderRadius: 6 }}>
      {items.length === 0 ? <em style={{ color: '#999' }}>Chưa có tin cho hôm nay.</em> : null}
      <ol>
        {items.map((it) => (
          <li key={it.rank}>
            {/* title đã sanitize ở server; React tự escape khi render text */}
            <a href={it.url} target="_blank" rel="noreferrer">{it.title}</a>
            <div style={{ fontSize: 12, color: '#666' }}>{it.summary}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RunsTable({ runs }: { runs: Run[] }) {
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18 }}>Trạng thái chạy (Runs)</h2>
      <table data-testid="runs-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>
            <th>Ngày</th><th>Bước</th><th>Trạng thái</th><th>Tìm/Chọn</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r, i) => (
            <tr key={i} data-testid={`run-status-${r.date}-${r.categoryId}`} style={{ borderBottom: '1px solid #f0f0f0' }}>
              <td>{r.date}</td>
              <td>{r.step}</td>
              <td>{r.status}</td>
              <td>{r.counts.found}/{r.counts.selected}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const primaryBtn: React.CSSProperties = { padding: '8px 14px', borderRadius: 6, border: 0, background: '#2563eb', color: '#fff', cursor: 'pointer' };
const smallBtn: React.CSSProperties = { padding: '5px 10px', borderRadius: 6, border: '1px solid #ccc', background: '#fff', cursor: 'pointer' };
const dangerBtn: React.CSSProperties = { padding: '5px 10px', borderRadius: 6, border: '1px solid #e0b4b4', background: '#fff', color: '#c0392b', cursor: 'pointer' };
const card: React.CSSProperties = { background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 14, marginBottom: 10 };
const inp: React.CSSProperties = { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', marginTop: 4, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, marginTop: 10 };
const modalOverlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const modalBox: React.CSSProperties = { background: '#fff', padding: 20, borderRadius: 8, maxWidth: 360 };
