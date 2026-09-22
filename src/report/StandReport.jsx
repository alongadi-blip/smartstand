import { money, num, pct, time } from '../lib/format.js';

const Line = ({ k, v, strong, tone }) => (
  <div className={'r-line' + (strong ? ' strong' : '') + (tone ? ' ' + tone : '')}><span>{k}</span><b>{v}</b></div>
);

function Block({ title, t, unit }) {
  return (
    <div className="r-block">
      {title && <h3>{title}</h3>}
      <Line k="סחורה שהובאה" v={`${num(t.brought)} ${unit}`} />
      <Line k="נמכרו" v={`${num(t.sold)} ${unit}`} />
      <Line k="נשארו" v={`${num(t.left)} ${unit}`} />
      <Line k="שווי מכירה במחיר מלא" v={money(t.full)} />
      <Line k="הכנסות בפועל" v={money(t.actual)} strong />
      <Line k="סה״כ הנחות" v={money(t.discount)} tone={t.discount ? 'warn-text' : ''} />
    </div>
  );
}

/** דוח סגירת דוכן — משמש גם את העובד וגם את המנהל */
export default function StandReport({ summary, standDay, standName }) {
  const { total: t, byCategory } = summary;
  const both = byCategory.flower.brought > 0 && byCategory.fruit.brought > 0;
  const cash = standDay?.cashCounted;
  return (
    <div className="report">
      {standName && <h2 className="r-title">{standName}</h2>}
      {both ? (
        <>
          <Block title="פרחים" t={byCategory.flower} unit="זרים" />
          <Block title="פירות" t={byCategory.fruit} unit="יח׳/מארזים" />
        </>
      ) : (
        <Block t={t} unit={byCategory.fruit.brought ? 'יח׳' : 'זרים'} />
      )}
      <div className="r-block total">
        {both && <h3>סה״כ דוכן</h3>}
        {both && <Line k="הכנסות בפועל" v={money(t.actual)} />}
        {both && <Line k="סה״כ הנחות" v={money(t.discount)} />}
        <Line k="יעד" v={money(t.target)} />
        <Line k="הכנסה בפועל" v={money(t.actual)} strong />
        <Line k="אחוז מהיעד" v={pct(t.targetPct)} />
        <Line k="פער מהיעד" v={money(t.gap)} tone="warn-text" />
        <div className="r-explain">מתוכו: הנחות {money(t.discount)} · סחורה שלא נמכרה (לפי מחיר מלא) {money(t.leftValue)}</div>
      </div>

      <div className="r-block total">
        <h3>לפי אמצעי תשלום</h3>
        <Line k="מזומן" v={money(t.cash)} strong />
        <Line k="ביט" v={money(t.bit)} strong />
        <div className="r-explain">ביט הוא {pct(t.bitPct)} מההכנסות</div>
        {cash != null && (
          <>
            <Line k="כסף שנספר בקופה" v={money(cash)} strong />
            {/* הקופה מושווה למזומן בלבד: תשלומי ביט לא עוברים בקופה */}
            <Line k="הפרש קופה מול המזומן" v={money(cash - t.cash)} tone={cash - t.cash ? 'warn-text' : ''} />
          </>
        )}
        {standDay?.closedAt && <div className="r-explain">נסגר ב-{time(standDay.closedAt)}{standDay.closedByName && ` ע״י ${standDay.closedByName}`}{standDay.closeNote && ` · ${standDay.closeNote}`}</div>}
      </div>
    </div>
  );
}
