import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { api } from './api.demo.js';
import { summarizeRange } from './history.js';
import { summarizeExpenses, netProfit, netMargin, goodsCountedTwice, EXPENSE_CATEGORIES } from './expenses.js';
import { ReportBody } from '../admin/Reports.jsx';

const STANDS = [
  { id: 'stand1', name: 'דוכן 1', order: 1 },
  { id: 'stand2', name: 'דוכן 2', order: 2 },
  { id: 'stand3', name: 'דוכן 3', order: 3, hasFruit: true },
  { id: 'stand4', name: 'דוכן 4', order: 4, hasFruit: true },
];

const rows = [
  { id: '1', date: '2026-09-04', category: 'goods', amount: 3200, note: 'שוק' },
  { id: '2', date: '2026-09-04', category: 'fuel', amount: 240, note: '' },
  { id: '3', date: '2026-09-11', category: 'salary', amount: 4800, note: '' },
  { id: '4', date: '2026-09-11', category: 'other', amount: 180, standId: 'stand2' },
];

describe('הוצאות', () => {
  it('מסכם לפי קטגוריה, לפי יום ולפי דוכן', () => {
    const s = summarizeExpenses(rows);
    expect(s.total).toBe(8420);
    expect(s.byCategory.goods).toBe(3200);
    expect(s.byCategory.fuel).toBe(240);
    expect(s.byCategory.salary).toBe(4800);
    expect(s.byCategory.other).toBe(180);
    expect(s.byDay['2026-09-04']).toBe(3440);
    expect(s.byDay['2026-09-11']).toBe(4980);
    expect(s.byStand.stand2).toBe(180);
    expect(s.byStand._all).toBe(8240);
    expect(s.count).toBe(4);
  });

  it('סכום הקטגוריות שווה לסה״כ', () => {
    const s = summarizeExpenses(rows);
    const sum = EXPENSE_CATEGORIES.reduce((a, c) => a + s.byCategory[c.id], 0);
    expect(Math.round(sum)).toBe(Math.round(s.total));
  });

  it('קטגוריה לא מוכרת נופלת ל״שונות״', () => {
    const s = summarizeExpenses([{ date: '2026-09-04', category: 'משהו אחר', amount: 100 }]);
    expect(s.byCategory.other).toBe(100);
    expect(s.total).toBe(100);
  });

  it('טווח ריק מחזיר אפסים ולא נופל', () => {
    const s = summarizeExpenses([]);
    expect(s.total).toBe(0);
    expect(s.byCategory.goods).toBe(0);
    expect(netProfit(0, 0)).toBe(0);
    expect(netMargin(0, 0)).toBe(0);
  });

  it('רווח נקי = הכנסות פחות הוצאות, כולל מינוס', () => {
    expect(netProfit(10000, 8420)).toBe(1580);
    expect(Math.round(netMargin(10000, 8420) * 1000) / 10).toBe(15.8);
    expect(netProfit(5000, 8420)).toBe(-3420);
    expect(netMargin(5000, 8420)).toBeLessThan(0);
  });

  it('מזהה ספירה כפולה של סחורה', () => {
    const withGoods = summarizeExpenses(rows);
    const noGoods = summarizeExpenses(rows.filter((r) => r.category !== 'goods'));
    expect(goodsCountedTwice({ hasCost: true }, withGoods)).toBe(true);
    expect(goodsCountedTwice({ hasCost: false }, withGoods)).toBe(false);
    expect(goodsCountedTwice({ hasCost: true }, noGoods)).toBe(false);
  });
});

describe('שכבת הנתונים של ההוצאות', () => {
  it('נשמרת, נטענת לפי טווח ונמחקת', async () => {
    const user = { uid: 'admin', name: 'מנהל' };
    await api.addExpense({ date: '2026-05-01', category: 'fuel', amount: 111, note: 'בדיקה' }, user);
    const inRange = await api.loadExpenses('2026-05-01', '2026-05-31');
    expect(inRange.some((e) => e.amount === 111)).toBe(true);
    const outOfRange = await api.loadExpenses('2026-06-01', '2026-06-30');
    expect(outOfRange.some((e) => e.amount === 111)).toBe(false);
    const mine = inRange.find((e) => e.amount === 111);
    await api.deleteExpense(mine.id);
    const after = await api.loadExpenses('2026-05-01', '2026-05-31');
    expect(after.some((e) => e.id === mine.id)).toBe(false);
  });
});

describe('הדוח עם הוצאות', () => {
  const loadAll = async () => {
    const days = await new Promise((res) => { const u = api.watchDays((d) => { u(); res(d); }); });
    const ids = days.map((d) => d.id).sort();
    return {
      ids,
      rows: await api.loadRange(ids[0], ids[ids.length - 1]),
      expenses: await api.loadExpenses(ids[0], ids[ids.length - 1]),
    };
  };

  it('נרנדר ומציג רווח נקי מול הכנסות והוצאות', async () => {
    const { ids, rows: r, expenses } = await loadAll();
    const data = summarizeRange(r, STANDS);
    const exp = summarizeExpenses(expenses);
    expect(exp.total).toBeGreaterThan(0);
    const html = renderToStaticMarkup(createElement(ReportBody, {
      data, exp, range: { from: ids[0], to: ids[ids.length - 1] },
    }));
    expect(html).toContain('הכנסות מול הוצאות');
    expect(html).toContain('רווח נקי');
    expect(html).toContain('מזומן מול ביט');
    expect(html).toContain('רווח גולמי');
    expect(html).toContain('משכורות');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('undefined');
  });

  it('נרנדר גם בלי הוצאות בכלל', async () => {
    const { ids, rows: r } = await loadAll();
    const data = summarizeRange(r, STANDS);
    const html = renderToStaticMarkup(createElement(ReportBody, {
      data, exp: summarizeExpenses([]), range: { from: ids[0], to: ids[ids.length - 1] },
    }));
    expect(html).toContain('רווח נקי');
    expect(html).not.toContain('NaN');
  });
});
