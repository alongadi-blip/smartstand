// שמות משתמש לעובדים הופכים לכתובת פנימית (לא נשלח אליה מייל)
export const USER_DOMAIN = 'smartstand.app';
export const toEmail = (u) => (u.includes('@') ? u.trim() : `${u.trim().toLowerCase()}@${USER_DOMAIN}`);

const nf = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 });
export const money = (n) => `₪${nf.format(Math.round((n || 0) * 100) / 100)}`;
export const num = (n) => nf.format(n || 0);
export const pct = (p) => `${(Math.round((p || 0) * 1000) / 10).toLocaleString('he-IL')}%`;

export const time = (ms) => new Date(ms).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

/** "יום מכירה אחד" / "9 ימי מכירה" */
export const saleDays = (n) => (n === 1 ? 'יום מכירה אחד' : `${num(n)} ימי מכירה`);

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export function dayLabel(dayId) {
  if (!dayId) return '';
  const [y, m, d] = dayId.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `יום ${DAYS[dt.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function toDayId(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** היום אם שישי, אחרת שישי הקרוב */
export function nextFriday(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7));
  return toDayId(d);
}

export const uid = () => Math.random().toString(36).slice(2, 10);
