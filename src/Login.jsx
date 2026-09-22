import { useEffect, useState } from 'react';
import { api, DEMO } from './lib/api.js';

const ERR = {
  'auth/invalid-credential': 'שם משתמש או סיסמה שגויים',
  'auth/wrong-password': 'שם משתמש או סיסמה שגויים',
  'auth/user-not-found': 'שם משתמש או סיסמה שגויים',
  'auth/too-many-requests': 'יותר מדי ניסיונות. נסה שוב בעוד כמה דקות',
  'auth/network-request-failed': 'אין חיבור לרשת',
  'auth/weak-password': 'הסיסמה צריכה לכלול לפחות 6 תווים',
  'auth/email-already-in-use': 'האימייל כבר רשום',
  // שירות ההתחברות לא הוקם / שיטת האימייל כבויה בקונסול של Firebase
  'auth/configuration-not-found': 'ההתחברות עדיין לא הופעלה בפרויקט: בקונסול של Firebase → Authentication → Get started → Email/Password → Enable.',
  'auth/operation-not-allowed': 'שיטת ההתחברות באימייל וסיסמה כבויה: בקונסול של Firebase → Authentication → Sign-in method → Email/Password → Enable.',
  'auth/invalid-email': 'כתובת האימייל לא תקינה',
  'permission-denied': 'אין הרשאה. נסו להתנתק ולהיכנס מחדש.',
};
const errText = (e) => ERR[e?.code || e?.message] || 'שגיאה: ' + (e?.message || e);

export default function Login() {
  const [boot, setBoot] = useState(null);
  useEffect(() => { api.isBootstrapped().then(setBoot).catch(() => setBoot(true)); }, []);

  if (DEMO) return <DemoLogin />;
  if (boot === null) return <div className="splash">טוען…</div>;
  return boot ? <LoginForm /> : <BootstrapForm />;
}

function Brand({ sub }) {
  return (
    <div className="brand">
      <div className="brand-mark" aria-hidden>✿</div>
      <h1>ניהול דוכנים</h1>
      {sub && <p>{sub}</p>}
    </div>
  );
}

function LoginForm() {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api.login(u, p); } catch (x) { setErr(errText(x)); setBusy(false); }
  };
  return (
    <div className="center-page">
      <form className="card login" onSubmit={submit}>
        <Brand />
        <label>שם משתמש<input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" autoCapitalize="none" required /></label>
        <label>סיסמה<input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required /></label>
        {err && <div className="error">{err}</div>}
        <button className="btn primary big" disabled={busy}>{busy ? 'מתחבר…' : 'כניסה'}</button>
      </form>
    </div>
  );
}

function BootstrapForm() {
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await api.bootstrapAdmin(f); } catch (x) { setErr(errText(x)); setBusy(false); }
  };
  return (
    <div className="center-page">
      <form className="card login" onSubmit={submit}>
        <Brand sub="הגדרה ראשונית: יצירת חשבון המנהל. המסך הזה מופיע פעם אחת בלבד." />
        <label>שם<input value={f.name} onChange={set('name')} required /></label>
        <label>אימייל<input type="email" value={f.email} onChange={set('email')} required /></label>
        <label>סיסמה (6 תווים לפחות)<input type="password" value={f.password} onChange={set('password')} minLength={6} required /></label>
        {err && <div className="error">{err}</div>}
        <button className="btn primary big" disabled={busy}>{busy ? 'יוצר…' : 'יצירת מנהל ו-4 דוכנים'}</button>
      </form>
    </div>
  );
}

function DemoLogin() {
  const users = api.demoUsers();
  return (
    <div className="center-page">
      <div className="card login">
        <Brand sub="מצב הדגמה — בחרו איך להיכנס" />
        {users.map((u) => (
          <button key={u.id} className={'btn big' + (u.role === 'admin' ? ' primary' : '')} onClick={() => api.demoLogin(u.id)}>
            {u.role === 'admin' ? 'כניסה כמנהל' : `עובד/ת ${u.standId.replace('stand', 'דוכן ')} — ${u.name}`}
          </button>
        ))}
      </div>
    </div>
  );
}
