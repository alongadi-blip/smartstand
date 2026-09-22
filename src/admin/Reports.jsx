import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { summarizeRange, rangeExtremes, rangePresets } from '../lib/history.js';
import { CATEGORY_LABEL } from '../lib/calc.js';
import { money, num, pct, dayLabel, saleDays } from '../lib/format.js';
import { Stat, Empty } from '../ui.jsx';
import { TrendChart, CategoryChart, RankBars } from './charts.jsx';

export default function Reports({ days, stands }) {
  const dayIds = useMemo(() => days.map((d) => d.id), [days]);
  const presets = useMemo(() => rangePresets(dayIds), [dayIds]);
  const [preset, setPreset] = useState('last4');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  // הטווח הנבחר: אחד המוכנים, או תאריכים שהמנהל הקליד
  const range = preset === 'custom'
    ? { from, to }
    : presets.find((p) => p.id === preset) || presets[0];

  useEffect(() => {
    if (!range?.from || !range?.to || range.from > range.to) { setRows(null); return; }
    let live = true;
    setRows(null);
    setError(null);
    api.loadRange(range.from, range.to)
      .then((r) => { if (live) setRows(r); })
      .catch((e) => { if (live) { console.error(e); setError(e); } });
    return () => { live = false; };
  }, [range?.from, range?.to]);

  const data = useMemo(() => (rows ? summarizeRange(rows, stands) : null), [rows, stands]);

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
      {!rows && !error && <div className="card splash">טוען דוח…</div>}
      {data && (data.daysCount === 0
        ? <div className="card"><Empty>אין ימי מכירה בטווח הזה.</Empty></div>
        : <ReportBody data={data} range={range} />)}
    </div>
  );
}

export function ReportBody({ data, range }) {
  const { total: T, byCategory: C, perDay, perStand, perItem, hasCost } = data;
  const ext = rangeExtremes(perDay);
  const anyFruit = C.fruit.brought > 0 || C.fruit.actual > 0;

  return (
    <>
      <section className="kpis">
        <Stat label="סה״כ הכנסות" value={money(T.actual)} sub={`${saleDays(data.daysCount)} · מתוך יעד ${money(T.target)}`} tone="hero" />
        <Stat label="אחוז מהיעד" value={pct(T.targetPct)} sub={`פער ${money(T.gap)}`} />
        <Stat label="ממוצע ליום מכירה" value={money(ext?.avg || 0)} sub={ext ? `הטוב ביותר ${money(ext.best.total.actual)} (${dayLabel(ext.best.dayId).replace('יום ', '')})` : null} />
        {hasCost
          ? <Stat label="רווח" value={money(T.profit)} sub={`אחוז רווח ${pct(T.margin)} · עלות ${money(T.cost)}`} tone={T.profit >= 0 ? 'good' : 'low'} />
          : <Stat label="רווח" value="—" sub="הזינו עלות למוצרים במסך הסחורה" />}
        <Stat label="מזומן" value={money(T.cash)} sub={`ביט ${money(T.bit)} · ${pct(T.bitPct)} מההכנסות`} />
        <Stat label="סה״כ הנחות" value={money(T.discount)} sub={`מחיר מלא ${money(T.full)}`} />
        <Stat label="ביצוע מלאי" value={pct(T.sellThrough)} sub={`נמכרו ${num(T.sold)} מתוך ${num(T.brought)} · נשארו בשווי ${money(T.leftValue)}`} />
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
          <div className="card-head"><h2>השוואה בין דוכנים</h2></div>
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
                <tr><th>דוכן</th><th>ימים</th><th>הכנסות</th><th>מזומן</th><th>ביט</th><th>יעד</th><th>% יעד</th><th>הנחות</th>{hasCost && <th>רווח</th>}</tr>
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
                <th>ממוצע ליח׳</th><th>הנחות</th>{hasCost && <><th>עלות</th><th>רווח</th><th>% רווח</th></>}
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
              <tr><th>יום</th><th>הכנסות</th><th>מזומן</th><th>ביט</th><th>יעד</th><th>% יעד</th><th>הנחות</th><th>נמכרו</th>{hasCost && <th>רווח</th>}<th>מכירות</th></tr>
            </thead>
            <tbody>
              {[...perDay].reverse().map((d) => (
                <tr key={d.dayId}>
                  <td>{dayLabel(d.dayId)}{d.closed && <small className="muted"> נסגר</small>}</td>
                  <td><b>{money(d.total.actual)}</b></td>
                  <td>{money(d.total.cash)}</td>
                  <td>{money(d.total.bit)}</td>
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
