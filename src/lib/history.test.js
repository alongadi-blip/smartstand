import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { api } from './api.demo.js';
import { summarizeRange, rangeExtremes, rangePresets } from './history.js';
import { summarizeExpenses } from './expenses.js';
import { ReportBody } from '../admin/Reports.jsx';

const noExpenses = () => summarizeExpenses([]);

const STANDS = [
  { id: 'stand1', name: 'דוכן 1', order: 1 },
  { id: 'stand2', name: 'דוכן 2', order: 2 },
  { id: 'stand3', name: 'דוכן 3', order: 3, hasFruit: true },
  { id: 'stand4', name: 'דוכן 4', order: 4, hasFruit: true },
];

const loadAll = async () => {
  const days = await new Promise((res) => { const u = api.watchDays((d) => { u(); res(d); }); });
  const ids = days.map((d) => d.id).sort();
  return { ids, rows: await api.loadRange(ids[0], ids[ids.length - 1]) };
};

describe('אגרגציה על טווח ימים', () => {
  it('הסכום הכולל שווה לסכום הימים', async () => {
    const { rows } = await loadAll();
    const r = summarizeRange(rows, STANDS);
    const sumOfDays = r.perDay.reduce((a, d) => a + d.total.actual, 0);
    expect(Math.round(sumOfDays)).toBe(Math.round(r.total.actual));
    expect(r.total.actual).toBeGreaterThan(0);
    expect(r.daysCount).toBe(rows.length);
  });

  it('הסכום הכולל שווה גם לסכום הדוכנים', async () => {
    const { rows } = await loadAll();
    const r = summarizeRange(rows, STANDS);
    const sumOfStands = r.perStand.reduce((a, s) => a + s.total.actual, 0);
    expect(Math.round(sumOfStands)).toBe(Math.round(r.total.actual));
    expect(r.perStand.length).toBe(4);
    // ממוין מהגבוה לנמוך, לתרשים ההשוואה
    expect(r.perStand[0].total.actual).toBeGreaterThanOrEqual(r.perStand[3].total.actual);
    expect(r.perStand[0].name).toMatch(/דוכן/);
  });

  it('מוצרים מאוחדים לפי שם על כל הימים והדוכנים', async () => {
    const { rows } = await loadAll();
    const r = summarizeRange(rows, STANDS);
    const names = r.perItem.map((i) => i.name);
    expect(new Set(names).size).toBe(names.length); // בלי כפילויות
    const sumOfItems = r.perItem.reduce((a, i) => a + i.actual, 0);
    expect(Math.round(sumOfItems)).toBe(Math.round(r.total.actual));
    // מוצר שנמכר ב-4 דוכנים × כמה ימים — הכמות גדולה מיום בודד
    const top = r.perItem[0];
    expect(top.sold).toBeGreaterThan(0);
    expect(top.brought).toBeGreaterThanOrEqual(top.sold);
  });

  it('רווח מחושב על הטווח כולו (בנתוני ההדגמה יש עלויות)', async () => {
    const { rows } = await loadAll();
    const r = summarizeRange(rows, STANDS);
    expect(r.hasCost).toBe(true);
    expect(r.total.cost).toBeGreaterThan(0);
    expect(Math.round(r.total.profit)).toBe(Math.round(r.total.actual - r.total.cost));
    expect(r.total.margin).toBeGreaterThan(0);
  });

  it('פילוח מזומן/ביט מסתכם להכנסות, בכל חתך', async () => {
    const { rows } = await loadAll();
    const r = summarizeRange(rows, STANDS);
    expect(r.total.bit).toBeGreaterThan(0);
    expect(Math.round(r.total.cash + r.total.bit)).toBe(Math.round(r.total.actual));
    for (const s of r.perStand) expect(Math.round(s.total.cash + s.total.bit)).toBe(Math.round(s.total.actual));
    for (const d of r.perDay) expect(Math.round(d.total.cash + d.total.bit)).toBe(Math.round(d.total.actual));
  });

  it('הטוב, הגרוע והממוצע', async () => {
    const { rows } = await loadAll();
    const { perDay } = summarizeRange(rows, STANDS);
    const ext = rangeExtremes(perDay);
    expect(ext.best.total.actual).toBeGreaterThanOrEqual(ext.worst.total.actual);
    expect(ext.avg).toBeGreaterThan(0);
    expect(ext.avg).toBeLessThanOrEqual(ext.best.total.actual);
  });

  it('טווח בלי ימי מכירה מחזיר ריק ולא נופל', () => {
    const r = summarizeRange([], STANDS);
    expect(r.daysCount).toBe(0);
    expect(r.total.actual).toBe(0);
    expect(rangeExtremes(r.perDay)).toBe(null);
  });

  it('הטווחים המוכנים תקינים — התחלה לפני הסוף', async () => {
    const { ids } = await loadAll();
    for (const p of rangePresets(ids, new Date('2026-09-22'))) {
      expect(p.from <= p.to, `${p.id}: ${p.from} → ${p.to}`).toBe(true);
    }
  });
});

describe('מסך הדוח נרנדר', () => {
  it('נרנדר עם נתוני ההדגמה ומציג את הסכומים', async () => {
    const { ids, rows } = await loadAll();
    const data = summarizeRange(rows, STANDS);
    const html = renderToStaticMarkup(createElement(ReportBody, {
      data, exp: noExpenses(), range: { from: ids[0], to: ids[ids.length - 1] },
    }));
    expect(html).toContain('השוואה בין דוכנים');
    expect(html).toContain('מוצרים מובילים');
    expect(html).toContain('כל ימי המכירה');
    expect(html).toContain('דוכן 1');
    // עמודה לכל יום מכירה, בשלושת התרשימים: יעד, תשלום, קטגוריה
    expect(html.split('col-stack').length - 1).toBe(data.perDay.length * 3);
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });

  it('נרנדר גם בלי עלויות — בלי עמודות רווח', () => {
    const noCost = [{
      id: '2026-09-18',
      stands: [{
        standId: 'stand1',
        items: [{ id: 'a', name: 'זר 70', category: 'flower', unit: 'זר', qty: 10, price: 70, options: [] }],
        sales: [{ itemId: 'a', itemName: 'זר 70', category: 'flower', units: 2, fullPrice: 140, actualPrice: 140, discount: 0, status: 'active', salesCount: 1 }],
        status: 'closed',
      }],
    }];
    const data = summarizeRange(noCost, STANDS);
    expect(data.hasCost).toBe(false);
    const html = renderToStaticMarkup(createElement(ReportBody, { data, exp: noExpenses(), range: { from: '2026-09-18', to: '2026-09-18' } }));
    // בלי עלות למוצר אין רווח גולמי, אבל רווח נקי מוצג תמיד
    expect(html).not.toContain('% גולמי');
    expect(html).toContain('רווח נקי');
    expect(html).not.toContain('NaN');
  });
});
