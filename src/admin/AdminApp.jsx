import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useWatch } from '../lib/hooks.js';
import { dayLabel, nextFriday } from '../lib/format.js';
import { Sheet, useToast, useUser } from '../ui.jsx';
import Dashboard from './Dashboard.jsx';
import Setup from './Setup.jsx';
import SalesLog from './SalesLog.jsx';
import Team from './Team.jsx';
import StandScreen from '../worker/StandScreen.jsx';

const TABS = [
  ['dash', 'לוח בקרה'],
  ['setup', 'סחורה ומחירים'],
  ['log', 'מכירות ותיקונים'],
  ['team', 'צוות ודוכנים'],
];

export default function AdminApp() {
  const user = useUser();
  const settings = useWatch('watchSettings', []).data || {};
  const days = useWatch('watchDays', []).data || [];
  const stands = (useWatch('watchStands', []).data || []).filter((s) => s.active !== false);
  const [tab, setTab] = useState('dash');
  const [dayId, setDayId] = useState(null);
  const [newDay, setNewDay] = useState(false);
  const [sellAs, setSellAs] = useState(null);

  // ברירת מחדל: היום הפעיל
  useEffect(() => { if (!dayId && settings.activeDayId) setDayId(settings.activeDayId); }, [settings.activeDayId, dayId]);

  if (sellAs) return <StandScreen dayId={dayId} standId={sellAs} onBack={() => setSellAs(null)} />;

  const isActive = dayId && dayId === settings.activeDayId;
  const allDays = days.some((d) => d.id === dayId) || !dayId ? days : [{ id: dayId }, ...days];

  return (
    <div className="admin">
      <header className="a-head">
        <div className="a-brand">✿ ניהול דוכנים</div>
        <div className="a-day">
          <select value={dayId || ''} onChange={(e) => setDayId(e.target.value)} aria-label="בחירת יום">
            {!dayId && <option value="">בחרו יום</option>}
            {allDays.map((d) => (
              <option key={d.id} value={d.id}>{dayLabel(d.id)}{d.id === settings.activeDayId ? ' (פעיל)' : ''}</option>
            ))}
          </select>
          {dayId && !isActive && <button className="btn small" onClick={() => api.setActiveDay(dayId)}>הפוך ליום הפעיל</button>}
          <button className="btn small primary" onClick={() => setNewDay(true)}>+ יום חדש</button>
        </div>
        <div className="a-user">{user.name} · <button className="link" onClick={api.logout}>יציאה</button></div>
      </header>
      <nav className="tabs">
        {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </nav>
      <main className="a-main">
        {!dayId && tab !== 'team' ? (
          <div className="card empty">
            עדיין אין ימי מכירה. <button className="btn primary" onClick={() => setNewDay(true)}>פתיחת יום ראשון</button>
          </div>
        ) : (
          <>
            {tab === 'dash' && <Dashboard dayId={dayId} stands={stands} isActive={isActive} onSellAs={setSellAs} onSetup={() => setTab('setup')} />}
            {tab === 'setup' && <Setup dayId={dayId} stands={stands} />}
            {tab === 'log' && <SalesLog dayId={dayId} stands={stands} />}
            {tab === 'team' && <Team stands={stands} />}
          </>
        )}
      </main>
      {newDay && <NewDaySheet days={days} onClose={() => setNewDay(false)} onCreated={(id) => { setDayId(id); setNewDay(false); setTab('setup'); }} />}
    </div>
  );
}

function NewDaySheet({ days, onClose, onCreated }) {
  const toast = useToast();
  const [date, setDate] = useState(nextFriday());
  const [copy, setCopy] = useState(days[0]?.id || '');
  const exists = days.some((d) => d.id === date);
  const create = async () => {
    await api.createDay(date, exists ? null : copy || null);
    await api.setActiveDay(date);
    toast('היום נפתח ✓ עכשיו אפשר לעדכן סחורה ומחירים');
    onCreated(date);
  };
  return (
    <Sheet title="פתיחת יום מכירות" onClose={onClose}>
      <label>תאריך<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      {exists ? <div className="warn">היום הזה כבר קיים — הוא פשוט יוגדר כיום הפעיל.</div> : (
        <label>להעתיק סחורה ומחירים מ־
          <select value={copy} onChange={(e) => setCopy(e.target.value)}>
            <option value="">לא להעתיק — להתחיל ריק</option>
            {days.map((d) => <option key={d.id} value={d.id}>{dayLabel(d.id)}</option>)}
          </select>
        </label>
      )}
      <p className="muted small">היום הפעיל הוא היום שהעובדים רואים ומוכרים בו.</p>
      <button className="btn big primary" onClick={create}>{exists ? 'הגדרה כיום פעיל' : 'פתיחת היום'}</button>
    </Sheet>
  );
}
