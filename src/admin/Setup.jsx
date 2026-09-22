import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useStandDay } from '../lib/hooks.js';
import { itemTarget } from '../lib/calc.js';
import { money, num, uid, dayLabel } from '../lib/format.js';
import { useToast } from '../ui.jsx';

const UNITS = ['זר', 'מארז', 'ק"ג', 'יחידה', 'עציץ'];

const newItem = (category) => category === 'fruit'
  ? { id: uid(), name: '', category, unit: 'מארז', qty: '', price: '', cost: '', options: [] }
  : { id: uid(), name: '', category, unit: 'זר', qty: '', price: '', cost: '', options: [] };

export default function Setup({ dayId, stands }) {
  const [standId, setStandId] = useState(stands[0]?.id);
  useEffect(() => { if (!standId && stands[0]) setStandId(stands[0].id); }, [stands, standId]);
  const stand = stands.find((s) => s.id === standId);
  return (
    <div className="setup">
      <div className="seg">
        {stands.map((s) => <button key={s.id} className={s.id === standId ? 'on' : ''} onClick={() => setStandId(s.id)}>{s.name}</button>)}
      </div>
      {stand && <StandItems key={dayId + stand.id} dayId={dayId} stand={stand} stands={stands} />}
    </div>
  );
}

function StandItems({ dayId, stand, stands }) {
  const toast = useToast();
  const { standDay, items: saved, summary, loading } = useStandDay(dayId, stand.id);
  const [items, setItems] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (!loading && !dirty) setItems(structuredClone(saved)); }, [loading, saved, dirty]);
  if (!items) return <div className="splash">טוען…</div>;

  const sold = Object.fromEntries(summary.items.map((r) => [r.id, r.sold]));
  const upd = (i, patch) => { setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it))); setDirty(true); };
  const add = (cat) => { setItems([...items, newItem(cat)]); setDirty(true); };
  const remove = (i) => { setItems(items.filter((_, j) => j !== i)); setDirty(true); };
  const move = (i, d) => { const a = [...items]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); setItems(a); setDirty(true); };

  const clean = items
    .filter((it) => it.name.trim())
    .map((it) => ({
      ...it, name: it.name.trim(), qty: Number(it.qty) || 0, price: Number(it.price) || 0, cost: Number(it.cost) || 0,
      options: (it.options || []).filter((o) => o.label?.trim() && Number(o.units) > 0 && o.price !== '')
        .map((o) => ({ ...o, label: o.label.trim(), units: Number(o.units), price: Number(o.price) })),
    }));
  const target = clean.reduce((a, it) => a + itemTarget(it), 0);

  const save = async () => {
    setBusy(true);
    try {
      await api.saveItems(dayId, stand.id, clean);
      setDirty(false);
      toast('נשמר ✓ העובדים רואים את העדכון מיד');
    } finally { setBusy(false); }
  };

  const copyToOthers = async () => {
    const targets = stands.filter((s) => s.id !== stand.id);
    if (!confirm(`להעתיק את רשימת הסחורה והמחירים של ${stand.name} ל: ${targets.map((s) => s.name).join(', ')}?\nהרשימה הקיימת שם תוחלף.${!stand.hasFruit ? '' : '\n(פירות יועתקו רק לדוכנים עם פירות)'}`)) return;
    for (const s of targets) {
      const list = clean.filter((it) => s.hasFruit || it.category !== 'fruit').map((it) => ({ ...it }));
      await api.saveItems(dayId, s.id, list);
    }
    toast('הועתק לשאר הדוכנים — בדקו כמויות בכל דוכן');
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2>{stand.name} · {dayLabel(dayId)}</h2>
        <div className="target-box">יעד הדוכן (אם הכול יימכר במחיר רגיל): <b>{money(target)}</b></div>
      </div>
      {standDay?.status === 'closed' && <div className="warn">הדוכן סגור ליום הזה. שינויים ישפיעו על היעד בדוחות.</div>}

      {!items.length && <p className="muted">אין עדיין מוצרים. הוסיפו זרים{stand.hasFruit && ' ופירות'} — כל מחיר זר הוא שורה נפרדת (למשל "זר 60", "זר 70").</p>}

      <div className="items-edit">
        {items.map((it, i) => (
          <div key={it.id} className={'item-edit ' + it.category}>
            <div className="ie-main">
              <span className="cat-tag">{it.category === 'fruit' ? 'פרי' : 'פרח'}</span>
              <label className="grow">שם המוצר<input value={it.name} placeholder={it.category === 'fruit' ? 'תותים' : 'זר 70'} onChange={(e) => upd(i, { name: e.target.value })} /></label>
              <label>יחידה
                <select value={it.unit} onChange={(e) => upd(i, { unit: e.target.value })}>
                  {UNITS.map((u) => <option key={u}>{u}</option>)}
                </select>
              </label>
              <label className="n">כמות<input type="number" inputMode="decimal" value={it.qty} onChange={(e) => upd(i, { qty: e.target.value })} /></label>
              <label className="n">מחיר רגיל ₪<input type="number" inputMode="decimal" value={it.price} onChange={(e) => upd(i, { price: e.target.value })} /></label>
              <label className="n" title="מה שילמתם ליחידה. לא חובה — משמש רק לחישוב הרווח בדוחות.">עלות ₪<input type="number" inputMode="decimal" placeholder="—" value={it.cost ?? ''} onChange={(e) => upd(i, { cost: e.target.value })} /></label>
              <div className="ie-target">יעד<b>{money(itemTarget({ qty: Number(it.qty), price: Number(it.price) }))}</b>{sold[it.id] > 0 && <small>נמכרו {num(sold[it.id])}</small>}</div>
              <div className="ie-actions">
                <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="למעלה">↑</button>
                <button className="icon-btn" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="למטה">↓</button>
                <button className="icon-btn danger" disabled={sold[it.id] > 0} title={sold[it.id] > 0 ? 'לא ניתן למחוק מוצר שכבר נמכר' : 'מחיקה'} onClick={() => remove(i)} aria-label="מחיקה">🗑</button>
              </div>
            </div>
            <div className="ie-opts">
              <span className="muted small">מבצעים / מחירים נוספים:</span>
              {(it.options || []).map((o, k) => (
                <div key={o.id} className="opt-edit">
                  <input className="w-label" placeholder='תווית, למשל "2 ב-35"' value={o.label}
                    onChange={(e) => upd(i, { options: it.options.map((x, m) => (m === k ? { ...x, label: e.target.value } : x)) })} />
                  <label>יח׳<input type="number" inputMode="decimal" value={o.units}
                    onChange={(e) => upd(i, { options: it.options.map((x, m) => (m === k ? { ...x, units: e.target.value } : x)) })} /></label>
                  <label>ב-₪<input type="number" inputMode="decimal" value={o.price}
                    onChange={(e) => upd(i, { options: it.options.map((x, m) => (m === k ? { ...x, price: e.target.value } : x)) })} /></label>
                  <button className="icon-btn" onClick={() => upd(i, { options: it.options.filter((_, m) => m !== k) })} aria-label="הסרת מבצע">✕</button>
                </div>
              ))}
              <button className="link" onClick={() => upd(i, { options: [...(it.options || []), { id: uid(), label: '', units: 1, price: '' }] })}>+ מבצע</button>
            </div>
          </div>
        ))}
      </div>

      <div className="row wrap">
        <button className="btn" onClick={() => add('flower')}>+ זר / פרח</button>
        {stand.hasFruit && <button className="btn" onClick={() => add('fruit')}>+ פרי</button>}
        <span className="spacer" />
        {clean.length > 0 && stands.length > 1 && <button className="btn ghost" onClick={copyToOthers} disabled={dirty}>העתקה לשאר הדוכנים</button>}
        <button className="btn primary" disabled={!dirty || busy} onClick={save}>{busy ? 'שומר…' : dirty ? 'שמירה' : 'נשמר'}</button>
      </div>
      <p className="muted small">המחיר הרגיל קובע את היעד ואת חישוב ההנחות. מבצע = כמות יחידות במחיר כולל (למשל 2 יח׳ ב-35 ₪). העובד יראה אותם ככפתורים. העלות לא חובה — מי שממלא אותה מקבל רווח ואחוז רווח בדוחות.</p>
    </div>
  );
}
