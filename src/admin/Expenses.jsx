import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useWatch } from '../lib/hooks.js';
import { EXPENSE_CATEGORIES, categoryLabel, summarizeExpenses } from '../lib/expenses.js';
import { money, toDayId, dayLabel } from '../lib/format.js';
import { Stat, Empty, useToast, useUser } from '../ui.jsx';

const monthId = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthBounds = (id) => {
  const [y, m] = id.split('-').map(Number);
  return { from: `${id}-01`, to: toDayId(new Date(y, m, 0)) };
};
const monthLabel = (id) => {
  const [y, m] = id.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
};

/** רשימת החודשים האחרונים לבחירה */
const recentMonths = (n = 12, today = new Date()) =>
  Array.from({ length: n }, (_, i) => monthId(new Date(today.getFullYear(), today.getMonth() - i, 1)));

export default function Expenses({ stands }) {
  const [month, setMonth] = useState(monthId(new Date()));
  const months = useMemo(() => recentMonths(), []);
  const { from, to } = monthBounds(month);
  const rows = useWatch('watchExpenses', [from, to]);
  const list = rows.data || [];
  const sum = useMemo(() => summarizeExpenses(list), [list]);

  return (
    <div className="expenses">
      <div className="card range-bar">
        <label className="month-pick">חודש
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </label>
      </div>

      <section className="kpis">
        <Stat label="סה״כ הוצאות בחודש" value={money(sum.total)} sub={`${sum.count} רשומות`} tone="hero" />
        {EXPENSE_CATEGORIES.map((c) => (
          <Stat key={c.id} label={c.label} value={money(sum.byCategory[c.id])}
            sub={sum.total ? `${Math.round((sum.byCategory[c.id] / sum.total) * 100)}% מההוצאות` : null} />
        ))}
      </section>

      <ExpenseForm stands={stands} defaultDate={month === monthId(new Date()) ? toDayId() : from} />

      <section className="card">
        <div className="card-head"><h2>הוצאות {monthLabel(month)}</h2></div>
        {rows.loading ? <div className="splash">טוען…</div> : !list.length ? (
          <Empty>אין הוצאות בחודש הזה.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>תאריך</th><th>קטגוריה</th><th>סכום</th><th>פירוט</th><th>דוכן</th><th>הוזן ע״י</th><th /></tr>
              </thead>
              <tbody>
                {list.map((e) => (
                  <ExpenseRow key={e.id} expense={e} stands={stands} />
                ))}
              </tbody>
              <tfoot>
                <tr><td>סה״כ</td><td /><td><b>{money(sum.total)}</b></td><td colSpan={4} /></tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ExpenseRow({ expense: e, stands }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const standName = e.standId ? (stands.find((s) => s.id === e.standId)?.name || e.standId) : 'כל העסק';
  return (
    <tr className={busy ? 'void' : ''}>
      <td>{dayLabel(e.date).replace('יום ', '')}</td>
      <td>{categoryLabel(e.category)}</td>
      <td><b>{money(e.amount)}</b></td>
      <td>{e.note || '—'}</td>
      <td>{standName}</td>
      <td>{e.createdByName || '—'}</td>
      <td>
        <button className="icon-btn danger" aria-label="מחיקת ההוצאה" disabled={busy}
          onClick={async () => {
            if (!confirm(`למחוק את ההוצאה ${categoryLabel(e.category)} · ${money(e.amount)}?`)) return;
            setBusy(true);
            try { await api.deleteExpense(e.id); toast('ההוצאה נמחקה'); } catch (x) { toast('שגיאה: ' + (x.code || x.message)); setBusy(false); }
          }}>🗑</button>
      </td>
    </tr>
  );
}

function ExpenseForm({ stands, defaultDate }) {
  const user = useUser();
  const toast = useToast();
  const blank = { date: defaultDate, category: 'goods', amount: '', note: '', standId: '' };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (ev) => {
    ev.preventDefault(); setErr(''); setBusy(true);
    try {
      if (!(Number(f.amount) > 0)) throw new Error('הסכום צריך להיות גדול מאפס');
      await api.addExpense(f, user);
      setF({ ...blank, date: f.date, category: f.category });
      toast('ההוצאה נרשמה ✓');
    } catch (x) {
      setErr(x.message || String(x));
    } finally { setBusy(false); }
  };

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h2>הוספת הוצאה</h2>
      <label>תאריך<input type="date" value={f.date} onChange={set('date')} required /></label>
      <label>קטגוריה
        <select value={f.category} onChange={set('category')}>
          {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label>סכום ₪<input type="number" inputMode="decimal" min="0" step="0.01" value={f.amount} onChange={set('amount')} required /></label>
      <label>פירוט (לא חובה)<input value={f.note} onChange={set('note')} placeholder="שוק הפרחים / סולר / ..." /></label>
      <label>דוכן (לא חובה)
        <select value={f.standId} onChange={set('standId')}>
          <option value="">כל העסק</option>
          {stands.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      {err && <div className="error">{err}</div>}
      <button className="btn primary" disabled={busy}>{busy ? 'שומר…' : 'רישום הוצאה'}</button>
      <p className="muted small">ההוצאות נכנסות לחישוב הרווח הנקי בדוחות. עובדי הדוכנים לא רואים אותן כלל.</p>
    </form>
  );
}
