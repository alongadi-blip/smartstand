import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { summarizeRange, rangeExtremes, rangePresets } from '../lib/history.js';
import { CATEGORY_LABEL } from '../lib/calc.js';
import { EXPENSE_CATEGORIES, summarizeExpenses, netProfit, netMargin, goodsCountedTwice } from '../lib/expenses.js';
import { money, num, pct, dayLabel, saleDays } from '../lib/format.js';
import { Stat, Empty } from '../ui.jsx';
import { TrendChart, CategoryChart, PaymentChart, RankBars } from './charts.jsx';

export default function Reports({ days, stands }) {
  const dayIds = useMemo(() => days.map((d) => d.id), [days]);
  const presets = useMemo(() => rangePresets(dayIds), [dayIds]);
  const [preset, setPreset] = useState('last4');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [error, setError] = useState(null);

  // הטווח הנבחר: אחד המוכנים, או תאריכים שהמנהל הקליד
  const range = preset === 'custom'
    ? { from, to }
    : presets.find((p) => p.id === preset) || presets[0];

  useEffect(() => {
    if (!range?.from || !range?.to || range.from > range.to) { setRows(null); return; }
    let live = true;
    setRows(null);
    setExpenses(null);
    setError(null);
    // המכירות וההוצאות נטענות יחד — הרווח הנקי מחייב את שתיהן
    Promise.all([api.loadRange(range.from, range.to), api.loadExpenses(range.from, range.to)])
      .then(([r, e]) => { if (live) { setRows(r); setExpenses(e); } })
      .catch((e) => { if (live) { console.error(e); setError(e); } });
    return () => { live = false; };
  }, [range?.from, range?.to]);

  const data = useMemo(() => (rows ? summarizeRange(rows, stands) : null), [rows, stands]);
  const exp = useMemo(() => (expenses ? summarizeExpenses(expenses) : null), [expenses]);

  return (
    <div className="reports">
      <div className="card range-bar">
        <div className="seg wrap">
          {presets.map((p) => (
            <button key={p.id} className={preset === p.id ? 'on' : ''} onClick={() => setPreset(p.id)}>{p.label}</button>
          ))}
          <button className={preset === 'custom' ? 'on' : ''} onClick={() => {
            setFrom(from || range?.from || '');
            setTo(to || range?.to || '');
            setPreset('custom');
          }}>טווח לבחירה</button>
        </div>
        {preset === 'custom' && (
          <div className="row wrap custom-range">
            <label>מתאריך<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label>עד תאריך<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            {from && to && from > to && <span className="warn small">התאריך הראשון מאוחר מהשני</span>}
          </div>
        )}
      </div>

      {error && <div className="card warn">לא הצלחתי לטעון את הדוח. אם זה נמשך — רעננו את הדף.</div>}
      {(!rows || !exp) && !error && <div className="card splash">טוען דוח…</div>}
      {data && exp && (data.daysCount === 0 && exp.count === 0
        ? <div className="card"><Empty>אין ימי מכירה ואין הוצאות בטווח הזה.</Empty></div>
        : <ReportBody data={data} exp={exp} range={range} />)}
    </div>
  );
}

export function ReportBody({ data, exp, range }) {
  const { total: T, byCategory: C, perDay, perStand, perItem, hasCost } = data;
  const ext = rangeExtremes(perDay);
  const anyFruit = C.fruit.brought > 0 || C.fruit.actual > 0;
  const net = netProfit(T.actual, exp.total);
  const doubleCount = goodsCountedTwice(data, exp);

  return (
    <>
      <section className="kpis">
        <Stat label="סה״כ הכנסות" value={money(T.actual)} sub={`${saleDays(data.daysCount)} · מתוך יעד ${money(T.target)}`} tone="hero" />
        <Stat label="סה״כ הוצאות" value={money(exp.total)} sub={`${exp.count} רשומות הוצאה`} />
        <Stat label="רווח נקי" value={money(net)} sub={`הכנסות פחות הוצאות · ${pct(netMargin(T.actual, exp.total))}`} tone={net >= 0 ? 'good' : 'low'} />
        <Stat label="אחוז מהיעד" value={pct(T.targetPct)} sub={`פער ${money(T.gap)}`} />
        <Stat label="ממוצע ליום מכירה" value={money(ext?.avg || 0)} sub={ext ? `הטוב ביותר ${money(ext.best.total.actual)} (${dayLabel(ext.best.dayId).replace('יום ', '')})` : null} />
        <Stat label="מזומן" value={money(T.cash)} sub={`ביט ${money(T.bit)} · ${pct(T.bitPct)} מההכנסות`} />
        <Stat label="סה״כ הנחות" value={money(T.discount)} sub={`מחיר מלא ${money(T.full)}`} />
        <Stat label="ביצוע מלאי" value={pct(T.sellThrough)} sub={`נמכרו ${num(T.sold)} מתוך ${num(T.brought)} · נשארו בשווי ${money(T.leftValue)}`} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2>הכנסות מול הוצאות</h2>
          <span className="muted small">{dayLabel(range.from).replace('יום ', '')} — {dayLabel(range.to).replace('יום ', '')}</span>
        </div>
        <RankBars rows={[
          { key: 'in', label: 'הכנסות', value: T.actual, title: `הכנסות ${money(T.actual)}` },
          { key: 'out', label: 'הוצאות', value: exp.total, tone: 'expense', title: `הוצאות ${money(exp.total)}` },
        ]} />
        <dl className="mini">
          <div><dt>רווח נקי</dt><dd className={net < 0 ? 'warn-text' : ''}>{money(net)}<small className="dd-sub">{pct(netMargin(T.actual, exp.total))} מההכנסות</small></dd></div>
          {EXPENSE_CATEGORIES.map((c) => (
            <div key={c.id}>
              <dt>{c.label}</dt>
              <dd>{money(exp.byCategory[c.id])}
                <small className="dd-sub">{exp.total ? pct(exp.byCategory[c.id] / exp.total) : '—'} מההוצאות</small>
              </dd>
            </div>
          ))}
        </dl>
        {doubleCount && (
          <div className="warn net-note">
            שימו לב: הזנתם גם עלות למוצרים במסך הסחורה וגם הוצאה בקטגוריית "פרחים וסחורה". שני אלה מודדים את אותו כסף.
            הרווח הנקי כאן מחושב לפי ההוצאות בלבד, ולכן אינו מחבר אותם פעמיים — אבל כדאי להחליט על שיטה אחת:
            ההוצאות נותנות את התמונה העסקית, והעלות לפי מוצר נותנת רווחיות לכל מוצר בנפרד.
          </div>
        )}
        {!hasCost && exp.total === 0 && (
          <div className="muted small net-note">אין עדיין הוצאות בטווח הזה — הזינו אותן בלשונית "הוצאות" כדי לקבל רווח נקי.</div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>הכנסות מול יעד לפי יום</h2>
          <span className="muted small">{dayLabel(range.from).replace('יום ', '')} — {dayLabel(range.to).replace('יום ', '')}</span>
        </div>
        <TrendChart perDay={perDay} />
      </section>

      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <h2>השוואה בין דוכנים</h2>
            {hasCost && <span className="muted small">רווח גולמי = הכנסות פחות עלות הסחורה שנמכרה</span>}
          </div>
          <RankBars rows={perStand.map((s) => ({
            key: s.standId,
            label: s.name,
            value: s.total.actual,
            sub: pct(s.total.targetPct),
            title: `${s.name}: ${money(s.total.actual)} מתוך יעד ${money(s.total.target)} · ${saleDays(s.days)}`,
          }))} />
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>דוכן</th><th>ימים</th><th>הכנסות</th><th>מזומן</th><th>ביט</th><th>יעד</th><th>% יעד</th><th>הנחות</th>{hasCost && <th>רווח גולמי</th>}</tr>
              </thead>
              <tbody>
                {perStand.map((s) => (
                  <tr key={s.standId}>
                    <td>{s.name}</td>
                    <td>{num(s.days)}</td>
                    <td><b>{money(s.total.actual)}</b></td>
                    <td>{money(s.total.cash)}</td>
                    <td>{money(s.total.bit)}<small className="muted"> {pct(s.total.bitPct)}</small></td>
                    <td>{money(s.total.target)}</td>
                    <td>{pct(s.total.targetPct)}</td>
                    <td>{money(s.total.discount)}</td>
                    {hasCost && <td className={s.total.profit < 0 ? 'warn-text' : ''}>{money(s.total.profit)}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>סה״כ</td><td /><td><b>{money(T.actual)}</b></td><td>{money(T.cash)}</td><td>{money(T.bit)}</td><td>{money(T.target)}</td>
                  <td>{pct(T.targetPct)}</td><td>{money(T.discount)}</td>{hasCost && <td>{money(T.profit)}</td>}
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>מזומן מול ביט</h2>
            <span className="muted small">ביט: {pct(T.bitPct)} מההכנסות</span>
          </div>
          <PaymentChart perDay={perDay} />
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>דוכן</th><th>מזומן</th><th>ביט</th><th>% ביט</th><th>סה״כ</th></tr></thead>
              <tbody>
                {perStand.map((s) => (
                  <tr key={s.standId}>
                    <td>{s.name}</td>
                    <td>{money(s.total.cash)}</td>
                    <td>{money(s.total.bit)}</td>
                    <td>{pct(s.total.bitPct)}</td>
                    <td><b>{money(s.total.actual)}</b></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>סה״כ</td><td><b>{money(T.cash)}</b></td><td><b>{money(T.bit)}</b></td><td>{pct(T.bitPct)}</td><td><b>{money(T.actual)}</b></td></tr>
              </tfoot>
            </table>
          </div>
          <p className="muted small">רק המזומן אמור להימצא בקופה בסוף היום. תשלומי ביט מגיעים לחשבון ולכן לא נספרים בה.</p>
        </section>

        {anyFruit && (
          <section className="card">
            <div className="card-head"><h2>{CATEGORY_LABEL.flower} מול {CATEGORY_LABEL.fruit}</h2></div>
            <CategoryChart perDay={perDay} />
            <dl className="mini">
              {['flower', 'fruit'].map((c) => (
                <div key={c}>
                  <dt>{CATEGORY_LABEL[c]}</dt>
                  <dd>{money(C[c].actual)}<small className="dd-sub">{num(C[c].sold)} מתוך {num(C[c].brought)} · {pct(C[c].sellThrough)}</small></dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>

      <section className="card">
        <div className="card-head">
          <h2>מוצרים מובילים</h2>
          <span className="muted small">{perItem.length} מוצרים בטווח</span>
        </div>
        <RankBars tone="item" rows={perItem.slice(0, 10).map((it) => ({
          key: it.key,
          label: it.name,
          value: it.actual,
          sub: `${num(it.sold)} ${it.unit || 'יח׳'}`,
          title: `${it.name}: ${money(it.actual)} · נמכרו ${num(it.sold)} · ממוצע ${money(it.avgPrice)} ליחידה`,
        }))} />
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>מוצר</th><th>הובאו</th><th>נמכרו</th><th>ביצוע</th><th>הכנסות</th>
                <th>ממוצע ליח׳</th><th>הנחות</th>{hasCost && <><th>עלות</th><th>רווח גולמי</th><th>% גולמי</th></>}
              </tr>
            </thead>
            <tbody>
              {perItem.map((it) => (
                <tr key={it.key}>
                  <td>{it.name} <small className="muted">{CATEGORY_LABEL[it.category]}</small></td>
                  <td>{num(it.brought)}</td>
                  <td>{num(it.sold)}</td>
                  <td>{pct(it.sellThrough)}</td>
                  <td><b>{money(it.actual)}</b></td>
                  <td>{money(it.avgPrice)}</td>
                  <td>{money(it.discount)}</td>
                  {hasCost && <><td>{money(it.cost)}</td><td className={it.profit < 0 ? 'warn-text' : ''}>{money(it.profit)}</td><td>{pct(it.margin)}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>כל ימי המכירה</h2></div>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>יום</th><th>הכנסות</th><th>מזומן</th><th>ביט</th><th>הוצאות</th><th>יעד</th><th>% יעד</th><th>הנחות</th><th>נמכרו</th>{hasCost && <th>רווח גולמי</th>}<th>מכירות</th></tr>
            </thead>
            <tbody>
              {[...perDay].reverse().map((d) => (
                <tr key={d.dayId}>
                  <td>{dayLabel(d.dayId)}{d.closed && <small className="muted"> נסגר</small>}</td>
                  <td><b>{money(d.total.actual)}</b></td>
                  <td>{money(d.total.cash)}</td>
                  <td>{money(d.total.bit)}</td>
                  <td>{exp.byDay[d.dayId] ? money(exp.byDay[d.dayId]) : '—'}</td>
                  <td>{money(d.total.target)}</td>
                  <td>{pct(d.total.targetPct)}</td>
                  <td>{money(d.total.discount)}</td>
                  <td>{num(d.total.sold)}</td>
                  {hasCost && <td className={d.total.profit < 0 ? 'warn-text' : ''}>{money(d.total.profit)}</td>}
                  <td>{num(d.total.salesCount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
