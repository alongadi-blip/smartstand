// תרשימים ב-HTML/CSS בלבד — בלי ספריית גרפים, בלי SVG.
// הסיבה: הטקסט נשאר בגודל אמיתי בכל רוחב מסך, וכיוון ימין-לשמאל נשמר מעצמו.
// לכל תרשים יש טבלה מקבילה בדוח, כדי שהצבע לא יהיה אף פעם הסימן היחיד.
import { CATEGORY_LABEL } from '../lib/calc.js';
import { money, pct, dayLabel } from '../lib/format.js';

const shortDay = (dayId) => {
  const [, m, d] = dayId.split('-');
  return `${d}/${m}`;
};

// קווי עזר: מלמעלה למטה, כשיעור מהמקסימום
const GRID = [1, 0.75, 0.5, 0.25];

function Axis({ max }) {
  return (
    <div className="chart-y" aria-hidden="true">
      {GRID.map((g) => <span key={g} style={{ bottom: g * 100 + '%' }}>{money(max * g)}</span>)}
    </div>
  );
}

function Grid() {
  return <div className="chart-grid" aria-hidden="true">{GRID.map((g) => <span key={g} style={{ bottom: g * 100 + '%' }} />)}</div>;
}

/** עמודות לפי יום: היעד ברקע, ההכנסות בפועל בתוכו. ציר אחד, אותו קנה מידה לשניהם. */
export function TrendChart({ perDay }) {
  const max = Math.max(...perDay.map((d) => Math.max(d.total.target, d.total.actual)), 1);
  const peak = perDay.reduce((a, d) => (d.total.actual > (a?.total.actual ?? -1) ? d : a), null);
  return (
    <figure className="chart">
      <div className="chart-legend">
        <span><i className="sw-actual" />בפועל</span>
        <span><i className="sw-target" />יעד</span>
      </div>
      <div className="chart-plot">
        <Axis max={max} />
        <div className="chart-area">
          <Grid />
          <ol className="cols">
            {perDay.map((d) => (
              <li key={d.dayId} title={`${dayLabel(d.dayId)} · בפועל ${money(d.total.actual)} מתוך יעד ${money(d.total.target)} (${pct(d.total.targetPct)})`}>
                <div className="col-stack">
                  <span className="col-target" style={{ height: (d.total.target / max) * 100 + '%' }} />
                  <span className="col-actual" style={{ height: (d.total.actual / max) * 100 + '%' }} />
                  {/* מספר רק על היום הגבוה — כל השאר בטבלה שמתחת */}
                  {d === peak && <b className="col-tag" style={{ bottom: (d.total.actual / max) * 100 + '%' }}>{money(d.total.actual)}</b>}
                </div>
                <span className="col-x">{shortDay(d.dayId)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <figcaption className="muted small">כל עמודה היא יום מכירה אחד. העמודה הבהירה והרחבה היא היעד של אותו יום.</figcaption>
    </figure>
  );
}

/** עמודות מוערמות: פרחים למטה, פירות מעליהם. אותו ציר. */
export function CategoryChart({ perDay }) {
  const max = Math.max(...perDay.map((d) => d.total.actual), 1);
  return (
    <figure className="chart">
      <div className="chart-legend">
        <span><i className="sw-flower" />{CATEGORY_LABEL.flower}</span>
        <span><i className="sw-fruit" />{CATEGORY_LABEL.fruit}</span>
      </div>
      <div className="chart-plot">
        <Axis max={max} />
        <div className="chart-area">
          <Grid />
          <ol className="cols">
            {perDay.map((d) => (
              <li key={d.dayId} title={`${dayLabel(d.dayId)} · ${CATEGORY_LABEL.flower} ${money(d.byCategory.flower.actual)} · ${CATEGORY_LABEL.fruit} ${money(d.byCategory.fruit.actual)}`}>
                <div className="col-stack stacked">
                  <span className="col-fruit" style={{ height: (d.byCategory.fruit.actual / max) * 100 + '%' }} />
                  <span className="col-flower" style={{ height: (d.byCategory.flower.actual / max) * 100 + '%' }} />
                </div>
                <span className="col-x">{shortDay(d.dayId)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <figcaption className="muted small">הגובה הכולל הוא ההכנסה של אותו יום.</figcaption>
    </figure>
  );
}

/** עמודות מוערמות: מזומן למטה, ביט מעליו. אותו ציר. */
export function PaymentChart({ perDay }) {
  const max = Math.max(...perDay.map((d) => d.total.actual), 1);
  return (
    <figure className="chart">
      <div className="chart-legend">
        <span><i className="sw-cash" />מזומן</span>
        <span><i className="sw-bit" />ביט</span>
      </div>
      <div className="chart-plot">
        <Axis max={max} />
        <div className="chart-area">
          <Grid />
          <ol className="cols">
            {perDay.map((d) => (
              <li key={d.dayId} title={`${dayLabel(d.dayId)} · מזומן ${money(d.total.cash)} · ביט ${money(d.total.bit)} (${pct(d.total.bitPct)})`}>
                <div className="col-stack stacked">
                  <span className="col-bit" style={{ height: (d.total.bit / max) * 100 + '%' }} />
                  <span className="col-cash" style={{ height: (d.total.cash / max) * 100 + '%' }} />
                </div>
                <span className="col-x">{shortDay(d.dayId)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <figcaption className="muted small">מזומן למטה, ביט מעליו — הגובה הכולל הוא ההכנסה של אותו יום.</figcaption>
    </figure>
  );
}

/**
 * עמודות אופקיות ממוינות מהגבוה לנמוך, עם המספר על כל עמודה.
 * משמש גם להשוואת דוכנים וגם למוצרים המובילים.
 */
export function RankBars({ rows, tone = 'actual' }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="rank-bars">
      {rows.map((r) => (
        <div className="rank-row" key={r.key} title={r.title || `${r.label}: ${money(r.value)}`}>
          <span className="rank-name">{r.label}</span>
          <span className="rank-track">
            <span className={'rank-fill ' + (r.tone || tone)} style={{ width: (r.value / max) * 100 + '%' }} />
          </span>
          <span className="rank-val">{money(r.value)}{r.sub && <small>{r.sub}</small>}</span>
        </div>
      ))}
    </div>
  );
}
