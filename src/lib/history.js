// אגרגציה על טווח ימים — לדוח השבועי/חודשי. בנוי מעל summarizeStand, בלי מבנה נתונים חדש.
import { summarizeStand, combineSummaries } from './calc.js';

const r2 = (n) => Math.round(n * 100) / 100;
// רק השדות המספריים מצטברים — שם המוצר והקטגוריה נשארים כמו שהם
const NUMERIC = ['brought', 'sold', 'left', 'target', 'full', 'actual', 'discount', 'cost', 'salesCount'];
const add = (t, s) => { for (const k of NUMERIC) t[k] = r2(t[k] + (s[k] || 0)); };
const emptyItem = () => Object.fromEntries(NUMERIC.map((k) => [k, 0]));

/**
 * days — מה ש-api.loadRange מחזיר.
 * stands — הדוכנים הפעילים (לשמות ולסדר).
 *
 * מחזיר:
 *   perDay   [{ dayId, total, byCategory, byStand: { standId: total }, closed }]
 *   perStand [{ stand, total, days }]  — ממוין לפי הכנסות, בשביל תרשים ההשוואה
 *   perItem  [{ key, name, category, ... }] — מאוחד לפי שם המוצר, כי מזהה מוצר נוצר מחדש בכל יום
 *   total, byCategory, hasCost
 */
export function summarizeRange(days = [], stands = []) {
  const standName = Object.fromEntries(stands.map((s) => [s.id, s.name]));
  const perDay = [];
  const standAcc = {};
  const itemAcc = {};
  const daySummaries = [];

  for (const day of days) {
    const summaries = [];
    const byStand = {};
    for (const sd of day.stands || []) {
      const s = summarizeStand(sd.items || [], sd.sales || []);
      summaries.push(s);
      byStand[sd.standId] = s.total;

      const acc = (standAcc[sd.standId] ||= { standId: sd.standId, name: standName[sd.standId] || sd.standId, summaries: [], days: 0 });
      acc.summaries.push(s);
      if (s.total.salesCount) acc.days += 1;

      for (const row of s.items) {
        const key = `${row.category}|${row.name}`;
        const it = (itemAcc[key] ||= { key, name: row.name, category: row.category, unit: row.unit, ...emptyItem() });
        add(it, row);
      }
    }
    const combined = combineSummaries(summaries);
    daySummaries.push(...summaries);
    perDay.push({
      dayId: day.id,
      total: combined.total,
      byCategory: combined.byCategory,
      byStand,
      closed: (day.stands || []).length > 0 && (day.stands || []).every((s) => s.status === 'closed'),
    });
  }

  const perStand = Object.values(standAcc)
    .map((a) => {
      const c = combineSummaries(a.summaries);
      return { standId: a.standId, name: a.name, days: a.days, total: c.total, byCategory: c.byCategory };
    })
    .sort((a, b) => b.total.actual - a.total.actual);

  const perItem = Object.values(itemAcc).map((it) => ({
    ...it,
    profit: r2(it.actual - it.cost),
    margin: it.actual ? (it.actual - it.cost) / it.actual : 0,
    avgPrice: it.sold ? r2(it.actual / it.sold) : 0,
    sellThrough: it.brought ? it.sold / it.brought : 0,
  })).sort((a, b) => b.actual - a.actual);

  const all = combineSummaries(daySummaries);
  return {
    perDay, perStand, perItem,
    total: all.total,
    byCategory: all.byCategory,
    hasCost: all.hasCost,
    daysCount: perDay.filter((d) => d.total.salesCount > 0).length,
  };
}

/** ממוצע ליום מכירה — היום עם הכי הרבה וזה עם הכי מעט */
export function rangeExtremes(perDay) {
  const active = perDay.filter((d) => d.total.salesCount > 0);
  if (!active.length) return null;
  const sorted = [...active].sort((a, b) => b.total.actual - a.total.actual);
  const sum = active.reduce((a, d) => a + d.total.actual, 0);
  return { best: sorted[0], worst: sorted[sorted.length - 1], avg: r2(sum / active.length) };
}

/** טווחי תאריכים מוכנים, מחושבים מרשימת ימי המכירה שקיימים */
export function rangePresets(dayIds = [], today = new Date()) {
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const monthStart = (back) => iso(new Date(today.getFullYear(), today.getMonth() - back, 1));
  const monthEnd = (back) => iso(new Date(today.getFullYear(), today.getMonth() - back + 1, 0));
  const sorted = [...dayIds].sort();
  const lastN = (n) => sorted.slice(-n)[0] || monthStart(0);
  return [
    { id: 'last4', label: '4 ימי המכירה האחרונים', from: lastN(4), to: sorted[sorted.length - 1] || iso(today) },
    { id: 'month', label: 'החודש הזה', from: monthStart(0), to: monthEnd(0) },
    { id: 'prev', label: 'החודש שעבר', from: monthStart(1), to: monthEnd(1) },
    { id: 'quarter', label: '3 החודשים האחרונים', from: monthStart(2), to: monthEnd(0) },
    { id: 'all', label: 'הכול', from: sorted[0] || monthStart(0), to: sorted[sorted.length - 1] || iso(today) },
  ];
}
