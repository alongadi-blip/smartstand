// הוצאות שוטפות — נשמרות בנפרד מהמכירות, באוסף expenses ברמת העסק.
// הוצאה משויכת לתאריך (גם תאריך שאינו יום מכירה), ואופציונלית לדוכן.

export const EXPENSE_CATEGORIES = [
  { id: 'goods', label: 'פרחים וסחורה' },
  { id: 'fuel', label: 'דלק' },
  { id: 'salary', label: 'משכורות' },
  { id: 'other', label: 'שונות' },
];

export const EXPENSE_LABEL = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.id, c.label]));
export const categoryLabel = (id) => EXPENSE_LABEL[id] || 'שונות';

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * סיכום הוצאות: סה"כ, לפי קטגוריה, לפי יום ולפי דוכן.
 * byCategory מוחזר גם עבור קטגוריות ריקות, כדי שהדוח לא ישנה מבנה בין טווחים.
 */
export function summarizeExpenses(expenses = []) {
  const byCategory = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.id, 0]));
  const byDay = {};
  const byStand = {};
  let total = 0;

  for (const e of expenses) {
    const amount = Number(e.amount) || 0;
    const cat = byCategory[e.category] !== undefined ? e.category : 'other';
    byCategory[cat] = r2(byCategory[cat] + amount);
    byDay[e.date] = r2((byDay[e.date] || 0) + amount);
    const key = e.standId || '_all';
    byStand[key] = r2((byStand[key] || 0) + amount);
    total = r2(total + amount);
  }

  return { total, byCategory, byDay, byStand, count: expenses.length };
}

/** רווח נקי = הכנסות בפועל פחות כל ההוצאות בטווח */
export function netProfit(actual, expensesTotal) {
  return r2((Number(actual) || 0) - (Number(expensesTotal) || 0));
}

export function netMargin(actual, expensesTotal) {
  const a = Number(actual) || 0;
  return a ? netProfit(a, expensesTotal) / a : 0;
}

/**
 * מזהה ספירה כפולה: המנהל הזין גם עלות למוצרים וגם הוצאה בקטגוריית סחורה.
 * שני אלה מודדים את אותו כסף, ולכן הדוח מזהיר במקום לחבר אותם.
 */
export function goodsCountedTwice(summary, expenseSummary) {
  return Boolean(summary?.hasCost && expenseSummary?.byCategory?.goods > 0);
}
