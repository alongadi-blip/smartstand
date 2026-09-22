import { useState } from 'react';
import { api } from '../lib/api.js';
import { useAllStandDays } from '../lib/hooks.js';
import { combineSummaries, lowStock, CATEGORY_LABEL } from '../lib/calc.js';
import { money, num, pct, time } from '../lib/format.js';
import { Stat, Progress, StatusChip, Sheet, Empty } from '../ui.jsx';
import StandReport from '../report/StandReport.jsx';

export default function Dashboard({ dayId, stands, isActive, onSellAs, onSetup }) {
  const all = useAllStandDays(dayId, stands);
  const [open, setOpen] = useState(null);
  const { total: T, byCategory: C, hasCost } = combineSummaries(all.map((a) => a.summary));
  const anyItems = all.some((a) => a.standDay?.items?.length);
  const maxActual = Math.max(...all.map((a) => Math.max(a.summary.total.target, a.summary.total.actual)), 1);

  if (all.length && all.every((a) => a.loaded) && !anyItems) {
    return (
      <div className="card empty">
        לא הוזנה סחורה ליום הזה.
        <button className="btn primary" onClick={onSetup}>להזנת סחורה ומחירים</button>
      </div>
    );
  }

  return (
    <div className="dash">
      <section className="kpis">
        <Stat label="סה״כ נמכר (בפועל)" value={money(T.actual)} sub={`מתוך יעד ${money(T.target)}`} tone="hero" />
        <Stat label="אחוז מהיעד" value={pct(T.targetPct)} sub={`נשאר ${money(T.toTarget)}`} />
        <Stat label="זרים שנמכרו" value={num(C.flower.sold)} sub={`מתוך ${num(C.flower.brought)} · ממוצע ${money(C.flower.avgPrice)}`} />
        <Stat label="פירות שנמכרו" value={num(C.fruit.sold)} sub={`מתוך ${num(C.fruit.brought)} · ${money(C.fruit.actual)}`} />
        <Stat label="סה״כ הנחות" value={money(T.discount)} sub={`מחיר מלא ${money(T.full)}`} />
        {hasCost && <Stat label="רווח היום" value={money(T.profit)} sub={`אחוז רווח ${pct(T.margin)} · עלות ${money(T.cost)}`} tone={T.profit >= 0 ? 'good' : 'low'} />}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>הכנסות מול יעד לפי דוכן</h2>
          <div className="legend"><i className="lg-actual" />בפועל <i className="lg-target" />יעד</div>
        </div>
        <div className="bars" role="table" aria-label="הכנסות מול יעד לפי דוכן">
          {all.map(({ stand, summary: s, standDay }) => (
            <div className="bar-row" role="row" key={stand.id} title={`${stand.name}: ${money(s.total.actual)} מתוך ${money(s.total.target)} (${pct(s.total.targetPct)})`}>
              <span className="bar-name" role="cell">{stand.name}</span>
              <div className="bar-track" role="cell">
                <span className="bar-target" style={{ width: (s.total.target / maxActual) * 100 + '%' }} />
                <span className={'bar-actual'} style={{ width: (s.total.actual / maxActual) * 100 + '%' }} />
              </div>
              <span className="bar-val" role="cell">{money(s.total.actual)} <small>{pct(s.total.targetPct)}</small></span>
              <StatusChip value={s.total.targetPct} closed={standDay?.status === 'closed'} />
            </div>
          ))}
        </div>
      </section>

      <section className="stand-cards">
        {all.map(({ stand, summary: s, standDay, sales }) => {
          const low = lowStock(s);
          const last = sales.filter((x) => x.status !== 'void').sort((a, b) => b.createdAt - a.createdAt)[0];
          const voids = sales.filter((x) => x.status === 'void').length;
          return (
            <article key={stand.id} className="card stand-card">
              <div className="card-head">
                <h2>{stand.name} <small>{stand.hasFruit ? 'פרחים + פירות' : 'פרחים'}</small></h2>
                <StatusChip value={s.total.targetPct} closed={standDay?.status === 'closed'} />
              </div>
              {!standDay?.items?.length ? <Empty>לא הוזנה סחורה</Empty> : (
                <>
                  <div className="big-num">{money(s.total.actual)}</div>
                  <Progress value={s.total.targetPct} />
                  <dl className="mini">
                    <div><dt>יעד</dt><dd>{money(s.total.target)}</dd></div>
                    <div><dt>נשאר ליעד</dt><dd>{money(s.total.toTarget)}</dd></div>
                    {['flower', 'fruit'].filter((c) => s.byCategory[c].brought).map((c) => (
                      <div key={c}><dt>{CATEGORY_LABEL[c]}</dt><dd>{money(s.byCategory[c].actual)}<small className="dd-sub">{num(s.byCategory[c].sold)} מתוך {num(s.byCategory[c].brought)}</small></dd></div>
                    ))}
                    <div><dt>הנחות</dt><dd>{money(s.total.discount)}</dd></div>
                    {s.hasCost && <div><dt>רווח</dt><dd className={s.total.profit < 0 ? 'warn-text' : ''}>{money(s.total.profit)}<small className="dd-sub">{pct(s.total.margin)}</small></dd></div>}
                    <div><dt>ביצוע מלאי</dt><dd>{pct(s.total.sellThrough)}</dd></div>
                    {standDay?.cashCounted != null && <div><dt>קופה שנספרה</dt><dd>{money(standDay.cashCounted)}</dd></div>}
                  </dl>
                  {low.length > 0 && <div className="warn small">⚠ מלאי נמוך: {low.map((r) => `${r.name} (${num(r.left)})`).join(', ')}</div>}
                  {voids > 0 && <div className="muted small">✎ {voids} תיקונים/ביטולים</div>}
                  <div className="muted small">{last ? `מכירה אחרונה ${time(last.createdAt)}` : 'עוד אין מכירות'}</div>
                </>
              )}
              <div className="row">
                <button className="btn small" onClick={() => setOpen(stand.id)}>פירוט ודוח</button>
                {isActive && standDay?.status !== 'closed' && standDay?.items?.length > 0 && <button className="btn small" onClick={() => onSellAs(stand.id)}>מסך מכירה</button>}
                {standDay?.status === 'closed' && <button className="btn small" onClick={() => api.reopenStand(dayId, stand.id)}>פתיחה מחדש</button>}
              </div>
            </article>
          );
        })}
      </section>

      {open && (() => {
        const a = all.find((x) => x.stand.id === open);
        return (
          <Sheet title={a.stand.name} onClose={() => setOpen(null)} wide>
            <ItemTable summary={a.summary} />
            <StandReport summary={a.summary} standDay={a.standDay} />
          </Sheet>
        );
      })()}
    </div>
  );
}

export function ItemTable({ summary }) {
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr><th>מוצר</th><th>הובא</th><th>נמכר</th><th>נשאר</th><th>מחיר מלא</th><th>בפועל</th><th>הנחות</th><th>ממוצע ליח׳</th></tr>
        </thead>
        <tbody>
          {summary.items.map((r) => (
            <tr key={r.id}>
              <td>{r.name}</td><td>{num(r.brought)}</td><td>{num(r.sold)}</td>
              <td className={r.brought && r.left / r.brought <= 0.2 ? 'warn-text' : ''}>{num(r.left)}</td>
              <td>{money(r.full)}</td><td><b>{money(r.actual)}</b></td><td>{money(r.discount)}</td><td>{money(r.avgPrice)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>סה״כ</td><td>{num(summary.total.brought)}</td><td>{num(summary.total.sold)}</td><td>{num(summary.total.left)}</td>
            <td>{money(summary.total.full)}</td><td><b>{money(summary.total.actual)}</b></td><td>{money(summary.total.discount)}</td><td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
