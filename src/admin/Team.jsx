import { useState } from 'react';
import { api } from '../lib/api.js';
import { useWatch } from '../lib/hooks.js';
import { useToast, useUser } from '../ui.jsx';

export default function Team() {
  const me = useUser();
  const toast = useToast();
  const users = useWatch('watchUsers', []).data || [];
  const allStands = useWatch('watchStands', []).data || [];
  const [f, setF] = useState({ name: '', username: '', password: '', role: 'worker', standId: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const standName = (id) => allStands.find((s) => s.id === id)?.name || '—';

  const create = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      if (f.role === 'worker' && !f.standId) throw new Error('בחרו דוכן לעובד');
      await api.createUser(f);
      setF({ name: '', username: '', password: '', role: 'worker', standId: '' });
      toast('המשתמש נוצר ✓');
    } catch (x) {
      setErr(x.code === 'auth/email-already-in-use' ? 'שם המשתמש תפוס' : x.code === 'auth/weak-password' ? 'סיסמה של 6 תווים לפחות' : x.message);
    } finally { setBusy(false); }
  };

  const addStand = async () => {
    const n = allStands.length + 1;
    const name = prompt('שם הדוכן החדש:', `דוכן ${n}`);
    if (!name) return;
    await api.saveStand({ id: 'stand' + Date.now().toString(36), name, hasFruit: confirm('האם נמכרים בו גם פירות?'), order: n, active: true });
  };

  return (
    <div className="team">
      <section className="card">
        <h2>עובדים ומנהלים</h2>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>שם</th><th>שם משתמש</th><th>תפקיד</th><th>דוכן</th><th>סטטוס</th></tr></thead>
            <tbody>
              {users.sort((a, b) => (a.role > b.role ? 1 : -1)).map((u) => (
                <tr key={u.id} className={u.active === false ? 'void' : ''}>
                  <td>{u.name}</td>
                  <td dir="ltr">{u.username}</td>
                  <td>{u.role === 'admin' ? 'מנהל' : 'עובד דוכן'}</td>
                  <td>
                    {u.role === 'worker' ? (
                      <select value={u.standId || ''} onChange={(e) => api.updateUser(u.id, { standId: e.target.value })} aria-label="דוכן">
                        {allStands.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    ) : 'כל הדוכנים'}
                  </td>
                  <td>
                    {u.id === me.uid ? 'אני' : (
                      <button className="link" onClick={() => api.updateUser(u.id, { active: u.active === false })}>
                        {u.active === false ? 'הפעלה מחדש' : 'השבתה'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">עובד מושבת לא יכול להיכנס. להחלפת סיסמה: השביתו ויצרו משתמש חדש (או דרך מסוף Firebase).</p>
      </section>

      <form className="card form-grid" onSubmit={create}>
        <h2>הוספת משתמש</h2>
        <label>שם<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></label>
        <label>שם משתמש (אנגלית/ספרות)<input dir="ltr" value={f.username} pattern="[A-Za-z0-9._\-]+" onChange={(e) => setF({ ...f, username: e.target.value })} required /></label>
        <label>סיסמה (6+ תווים)<input dir="ltr" value={f.password} minLength={6} onChange={(e) => setF({ ...f, password: e.target.value })} required /></label>
        <label>תפקיד
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="worker">עובד דוכן</option><option value="admin">מנהל</option>
          </select>
        </label>
        {f.role === 'worker' && (
          <label>דוכן
            <select value={f.standId} onChange={(e) => setF({ ...f, standId: e.target.value })} required>
              <option value="">בחרו…</option>
              {allStands.filter((s) => s.active !== false).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        {err && <div className="error">{err}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'יוצר…' : 'יצירת משתמש'}</button>
      </form>

      <section className="card">
        <div className="card-head"><h2>דוכנים</h2><button className="btn small" onClick={addStand}>+ דוכן חדש</button></div>
        <div className="stand-list">
          {allStands.map((s) => (
            <div key={s.id} className={'stand-edit' + (s.active === false ? ' void' : '')}>
              <input defaultValue={s.name} aria-label="שם הדוכן" onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && api.saveStand({ id: s.id, name: e.target.value.trim() })} />
              <label className="check"><input type="checkbox" checked={!!s.hasFruit} onChange={(e) => api.saveStand({ id: s.id, hasFruit: e.target.checked })} /> פירות</label>
              <label className="check"><input type="checkbox" checked={s.active !== false} onChange={(e) => api.saveStand({ id: s.id, active: e.target.checked })} /> פעיל</label>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
