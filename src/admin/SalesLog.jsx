import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAllStandDays } from '../lib/hooks.js';
import { money, num, time } from '../lib/format.js';
import { Empty, useUser, useToast } from '../ui.jsx';

const KIND = { regular: 'רגיל', promo: 'מבצע', discount: 'הנחה' };

export default function SalesLog({ dayId, stands }) {
  const user = useUser();
  const toast = useToast();
  const all = useAllStandDays(dayId, stands);
  const [standF, setStandF] = useState('all');
  const [kindF, setKindF] = useState('all');

  const rows = all.flatMap((a) => a.sales.map((s) => ({ ...s, standId: a.stand.id, standName: a.stand.name })))
    .filter((s) => standF === 'all' || s.standId === standF)
    .filter((s) => kindF === 'all'
      || (kindF === 'fix' ? s.status === 'void' || s.correctionOf : kindF === 'disc' ? s.discount > 0 && s.status !== 'void' : true))
    .sort((a, b) => b.createdAt - a.createdAt);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  const fixes = all.reduce((n, a) => n + a.sales.filter((s) => s.status === 'void').length, 0);

  return (
    <div className="card">
      <div className="card-head">
        <h2>יומן מכירות</h2>
        <div className="row wrap">
          <select value={standF} onChange={(e) => setStandF(e.target.value)} aria-label="סינון לפי דוכן">
            <option value="all">כל הדוכנים</option>
            {stands.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="seg small">
            <button className={kindF === 'all' ? 'on' : ''} onClick={() => setKindF('all')}>הכול</button>
            <button className={kindF === 'disc' ? 'on' : ''} onClick={() => setKindF('disc')}>עם הנחה</button>
            <button className={kindF === 'fix' ? 'on' : ''} onClick={() => setKindF('fix')}>תיקונים וביטולים ({fixes})</button>
          </div>
        </div>
      </div>
      {!rows.length ? <Empty>אין מכירות להצגה</Empty> : (
        <div className="table-wrap">
          <table className="tbl log">
            <thead><tr><th>שעה</th><th>דוכן</th><th>מוצר</th><th>כמות</th><th>סוג</th><th>מחיר מלא</th><th>בפועל</th><th>הנחה</th><th>עובד</th><th /></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={s.status === 'void' ? 'void' : s.correctionOf ? 'fixed' : ''}>
                  <td>{time(s.createdAt)}</td>
                  <td>{s.standName}</td>
                  <td>{s.itemName}{s.kind === 'promo' && <small> · {s.optionLabel}</small>}</td>
                  <td>{num(s.units)}</td>
                  <td>{KIND[s.kind]}</td>
                  <td>{money(s.fullPrice)}</td>
                  <td><b>{money(s.actualPrice)}</b></td>
                  <td>{s.discount ? money(s.discount) : '—'}</td>
                  <td>{s.createdByName}</td>
                  <td className="note">
                    {s.status === 'void' && <span className="tag void">בוטל {s.voidedAt && time(s.voidedAt)}{s.voidedByName && ` ע״י ${s.voidedByName}`}{s.voidReason && ` — ${s.voidReason}`}{s.replacedBy && ' · הוחלף'}</span>}
                    {s.correctionOf && <span className="tag fixed">תיקון של {byId[s.correctionOf] ? `${byId[s.correctionOf].itemName} ${money(byId[s.correctionOf].actualPrice)}` : 'מכירה קודמת'}</span>}
                    {s.status !== 'void' && (
                      <button className="link" onClick={async () => {
                        const reason = prompt('סיבת הביטול:', 'ביטול ע״י מנהל');
                        if (reason === null) return;
                        await api.voidSale(dayId, s.standId, s.id, reason, user);
                        toast('המכירה בוטלה');
                      }}>ביטול</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted small">מכירה שבוטלה או תוקנה לא נמחקת — היא מסומנת ולא נספרת בסיכומים.</p>
    </div>
  );
}
