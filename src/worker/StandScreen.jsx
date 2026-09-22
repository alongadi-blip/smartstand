import { useState } from 'react';
import { api } from '../lib/api.js';
import { useStandDay, useWatch } from '../lib/hooks.js';
import { buildSale, saleOptions, CATEGORY_LABEL } from '../lib/calc.js';
import { money, num, time, dayLabel } from '../lib/format.js';
import { useUser, useToast, Sheet, Empty } from '../ui.jsx';
import StandReport from '../report/StandReport.jsx';

export default function StandScreen({ dayId, standId, onBack }) {
  const user = useUser();
  const toast = useToast();
  const stand = useWatch('watchStand', [standId]).data;
  const { loading, standDay, items, sales, summary } = useStandDay(dayId, standId);
  const [picked, setPicked] = useState(null);       // פריט שנבחר למכירה
  const [fixing, setFixing] = useState(null);       // מכירה בתיקון
  const [showSales, setShowSales] = useState(false);
  const [closing, setClosing] = useState(false);

  const closed = standDay?.status === 'closed';
  const rows = Object.fromEntries(summary.items.map((r) => [r.id, r]));

  const record = async (sale) => {
    if (fixing) {
      const orig = fixing;
      setFixing(null); setPicked(null);
      await api.correctSale(dayId, standId, orig.id, sale, 'תיקון מכירה', user);
      toast('המכירה תוקנה ✓');
      return;
    }
    setPicked(null);
    const id = await api.addSale(dayId, standId, sale, user);
    toast(`נרשם: ${sale.itemName} · ${money(sale.actualPrice)}`, {
      label: 'ביטול',
      fn: () => api.voidSale(dayId, standId, id, 'בוטל מיד לאחר ההזנה', user),
    });
  };

  const header = (
    <header className="w-head">
      {onBack && <button className="icon-btn" onClick={onBack} aria-label="חזרה">→</button>}
      <div className="w-title">
        <h1>{stand?.name || 'הדוכן שלי'}</h1>
        <span>{dayLabel(dayId)}{closed && ' · נסגר'}</span>
      </div>
      {!onBack && <button className="btn ghost small" onClick={api.logout}>יציאה</button>}
    </header>
  );

  if (loading) return <div className="worker">{header}<div className="splash">טוען…</div></div>;
  if (!standId) return <div className="worker">{header}<Empty>לא שויכת לדוכן. פנה למנהל.</Empty></div>;
  if (!items.length) return <div className="worker">{header}<Empty>הסחורה לדוכן עוד לא הוזנה להיום.<br />המנהל יזין אותה ואז יופיעו כאן כפתורי המכירה.</Empty></div>;

  const t = summary.total;
  const cats = ['flower', 'fruit'].filter((c) => items.some((i) => i.category === c));

  return (
    <div className="worker">
      {header}

      <section className="w-summary">
        <div><b>{money(t.actual)}</b><span>נמכר</span></div>
        {cats.map((c) => (
          <div key={c}><b>{num(summary.byCategory[c].sold)}</b><span>{c === 'flower' ? 'זרים' : 'פירות'}</span></div>
        ))}
        <div><b>{money(t.discount)}</b><span>הנחות</span></div>
      </section>

      {closed ? (
        <section className="w-closed">
          <StandReport summary={summary} standDay={standDay} standName={stand?.name} />
        </section>
      ) : (
        <>
          {fixing && (
            <div className="fix-banner">
              מתקן את: <b>{fixing.itemName} · {money(fixing.actualPrice)}</b> — בחרו את המכירה הנכונה
              <button className="btn small" onClick={() => setFixing(null)}>ביטול תיקון</button>
            </div>
          )}
          {cats.map((c) => (
            <section key={c} className="w-cat">
              {cats.length > 1 && <h2>{CATEGORY_LABEL[c]}</h2>}
              <div className="item-grid">
                {items.filter((i) => i.category === c).map((it) => {
                  const r = rows[it.id];
                  const out = r && r.left <= 0;
                  return (
                    <button key={it.id} className={'item-btn ' + c + (out ? ' out' : '')} onClick={() => setPicked(it)}>
                      <span className="item-name">{it.name}</span>
                      <span className="item-price">{money(it.price)}{it.unit === 'ק"ג' ? ' לק"ג' : ''}</span>
                      <span className="item-left">{out ? 'אזל המלאי' : `נשארו ${num(r?.left)}`}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}

      <footer className="w-foot">
        <button className="btn big" onClick={() => setShowSales(true)}>מכירות ({sales.filter((s) => s.status !== 'void').length})</button>
        {!closed && <button className="btn big danger-outline" onClick={() => setClosing(true)}>סגירת דוכן</button>}
      </footer>

      {picked && <SaleSheet item={picked} fixing={fixing} onClose={() => setPicked(null)} onSale={record} />}
      {showSales && (
        <SalesSheet sales={sales} closed={closed} onClose={() => setShowSales(false)}
          onFix={(s) => { setShowSales(false); setFixing(s); toast('בחרו את הפריט הנכון'); }}
          onVoid={async (s, reason) => { await api.voidSale(dayId, standId, s.id, reason, user); toast('המכירה בוטלה'); }} />
      )}
      {closing && (
        <CloseSheet summary={summary} standName={stand?.name} onClose={() => setClosing(false)}
          onConfirm={async (data) => { await api.closeStand(dayId, standId, data, user); setClosing(false); toast('הדוכן נסגר ✓'); }} />
      )}
    </div>
  );
}

// ---------- בחירת מחיר: רגיל / מבצע / הנחה ----------
function SaleSheet({ item, fixing, onClose, onSale }) {
  const [times, setTimes] = useState(1);
  const [discountMode, setDiscountMode] = useState(false);
  const [actual, setActual] = useState('');
  const opts = saleOptions(item);
  const full = item.price * times;

  return (
    <Sheet title={item.name} onClose={onClose}>
      <div className="qty-row">
        <span>כמות</span>
        <div className="stepper">
          <button onClick={() => setTimes(Math.max(1, times - 1))} aria-label="פחות">−</button>
          <b>{times}</b>
          <button onClick={() => setTimes(times + 1)} aria-label="יותר">+</button>
        </div>
      </div>

      {!discountMode ? (
        <div className="opt-grid">
          {opts.map((o) => (
            <button key={o.id} className={'opt-btn ' + o.kind}
              onClick={() => onSale(buildSale(item, { option: o, times }))}>
              <span>{o.kind === 'regular' ? 'מחיר רגיל' : o.label}</span>
              <b>{money(o.price * times)}</b>
              {o.units * times > 1 && <small>{num(o.units * times)} {item.unit || 'יח׳'}</small>}
            </button>
          ))}
          <button className="opt-btn discount" onClick={() => { setDiscountMode(true); setActual(String(full)); }}>
            <span>הנחה</span><b>מחיר אחר…</b>
          </button>
        </div>
      ) : (
        <div className="discount-box">
          <div className="muted">מחיר מלא: {money(full)} ({times} × {money(item.price)})</div>
          <label className="big-input">מחיר בפועל
            <input type="number" inputMode="decimal" value={actual} autoFocus onChange={(e) => setActual(e.target.value)} />
          </label>
          <div className="chips">
            {[5, 10, 15, 20].map((d) => (
              <button key={d} className="btn small" onClick={() => setActual(String(Math.max(full - d, 0)))}>−{d} ₪</button>
            ))}
          </div>
          {actual !== '' && <div className="discount-line">הנחה: <b>{money(Math.max(full - Number(actual), 0))}</b></div>}
          <div className="row">
            <button className="btn big" onClick={() => setDiscountMode(false)}>חזרה</button>
            <button className="btn big primary" disabled={actual === '' || Number(actual) < 0}
              onClick={() => onSale(buildSale(item, { option: null, actualPrice: actual, discountUnits: times }))}>
              {fixing ? 'שמירת תיקון' : 'אישור מכירה'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ---------- רשימת מכירות + תיקון/ביטול ----------
function SalesSheet({ sales, closed, onClose, onFix, onVoid }) {
  const [sel, setSel] = useState(null);
  const [reason, setReason] = useState('');
  const list = [...sales].sort((a, b) => b.createdAt - a.createdAt);
  return (
    <Sheet title="המכירות שלי היום" onClose={onClose}>
      {!list.length && <Empty>עדיין אין מכירות</Empty>}
      <ul className="sale-list">
        {list.map((s) => (
          <li key={s.id} className={s.status === 'void' ? 'void' : ''}>
            <button className="sale-row" disabled={closed || s.status === 'void'} onClick={() => { setSel(s); setReason(''); }}>
              <span className="t">{time(s.createdAt)}</span>
              <span className="n">{s.itemName} {s.units > 1 && `×${num(s.units)}`}<small>{s.optionLabel}{s.correctionOf && ' · תיקון'}</small></span>
              <span className="p">{money(s.actualPrice)}{s.discount > 0 && <small>הנחה {money(s.discount)}</small>}</span>
            </button>
            {s.status === 'void' && <div className="void-note">בוטל{s.voidReason && `: ${s.voidReason}`}</div>}
          </li>
        ))}
      </ul>
      {sel && (
        <div className="action-box">
          <b>{sel.itemName} · {money(sel.actualPrice)} · {time(sel.createdAt)}</b>
          <div className="row">
            <button className="btn big primary" onClick={() => onFix(sel)}>תיקון</button>
            <button className="btn big danger-outline" onClick={() => { onVoid(sel, reason || 'בוטל ע״י העובד'); setSel(null); }}>ביטול מכירה</button>
          </div>
          <input placeholder="סיבה (לא חובה)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <p className="muted small">המנהל רואה כל תיקון וביטול — הנתון המקורי נשמר.</p>
        </div>
      )}
    </Sheet>
  );
}

// ---------- סגירת דוכן ----------
function CloseSheet({ summary, standName, onClose, onConfirm }) {
  const [cash, setCash] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="סגירת דוכן" onClose={onClose} wide>
      <StandReport summary={summary} standName={standName} />
      <label className="big-input">כסף שנספר בקופה (לא חובה)
        <input type="number" inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)} placeholder={String(summary.total.actual)} />
      </label>
      {cash !== '' && Number(cash) !== summary.total.actual && (
        <div className="warn">הפרש מול המכירות שנרשמו: {money(Number(cash) - summary.total.actual)}</div>
      )}
      <input placeholder="הערה (לא חובה)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn big primary" disabled={busy} onClick={() => { setBusy(true); onConfirm({ cashCounted: cash, note }); }}>
        אישור וסגירת הדוכן
      </button>
      <p className="muted small">אחרי הסגירה לא ניתן להוסיף מכירות. המנהל יכול לפתוח מחדש.</p>
    </Sheet>
  );
}
