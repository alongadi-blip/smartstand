import { useEffect, useState } from 'react';
import { api, DEMO } from './lib/api.js';
import { useWatch } from './lib/hooks.js';
import { UserCtx, ToastHost, Empty } from './ui.jsx';
import Login from './Login.jsx';
import StandScreen from './worker/StandScreen.jsx';
import AdminApp from './admin/AdminApp.jsx';

export default function App() {
  const [auth, setAuth] = useState(undefined);
  useEffect(() => api.onAuth(setAuth), []);
  const profile = useWatch('watchProfile', [auth?.uid]);

  if (auth === undefined || (auth && profile.loading)) return <div className="splash">טוען…</div>;
  if (!auth) return <Login />;

  const p = profile.data;
  if (!p || p.active === false) {
    return (
      <div className="center-page">
        <Empty>
          החשבון אינו פעיל או לא הוגדר במערכת.<br />פנה למנהל.
          <br /><br /><button className="btn" onClick={api.logout}>התנתקות</button>
        </Empty>
      </div>
    );
  }
  const user = { uid: auth.uid, ...p };
  return (
    <UserCtx.Provider value={user}>
      <ToastHost>
        {DEMO && <div className="demo-bar">מצב הדגמה — הנתונים לא נשמרים · <button onClick={api.logout}>החלפת משתמש</button></div>}
        {user.role === 'admin' ? <AdminApp /> : <WorkerHome user={user} />}
      </ToastHost>
    </UserCtx.Provider>
  );
}

function WorkerHome({ user }) {
  const settings = useWatch('watchSettings', []);
  if (settings.loading) return <div className="splash">טוען…</div>;
  const dayId = settings.data?.activeDayId;
  if (!dayId) return <div className="center-page"><Empty>עדיין לא נפתח יום מכירות.<br />המנהל צריך לפתוח יום ולהזין סחורה.</Empty></div>;
  return <StandScreen dayId={dayId} standId={user.standId} />;
}
