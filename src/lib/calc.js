// חישובים טהורים — ללא תלות ב-Firebase. כל המספרים בשקלים.

export const CATEGORY = { flower: 'flower', fruit: 'fruit' };
export const CATEGORY_LABEL = { flower: 'פרחים', fruit: 'פירות' };

const r2 = (n) => Math.round(n * 100) / 100;

/** יעד פריט: כל הכמות במחיר הרגיל */
export function itemTarget(item) {
  return r2((Number(item.qty) || 0) * (Number(item.price) || 0));
}

/** מחיר מלא למכירה: יחידות × מחיר רגיל ליחידה */
export function fullPriceFor(item, units) {
  return r2(units * (Number(item.price) || 0));
}

/** האפשרויות שהעובד רואה: מחיר רגיל + מבצעים שהמנהל הגדיר */
export function saleOptions(item) {
  const regular = { id: 'regular', label: 'מחיר רגיל', units: 1, price: Number(item.price) || 0, kind: 'regular' };
  const promos = (item.options || [])
    .filter((o) => Number(o.units) > 0 && Number(o.price) >= 0)
    .map((o) => ({ ...o, units: Number(o.units), price: Number(o.price), kind: 'promo' }));
  return [regular, ...promos];
}

/**
 * בונה רשומת מכירה.
 * option: אחת מ-saleOptions, או null להנחה ידנית (אז actualPrice חובה).
 * times: כמה פעמים נמכרה האפשרות (למשל 3 זרים במחיר רגיל).
 */
export function buildSale(item, { option, times = 1, actualPrice, discountUnits = 1 }) {
  let units, actual, kind, optionLabel;
  if (option) {
    units = option.units * times;
    actual = r2(option.price * times);
    kind = option.kind;
    optionLabel = option.kind === 'regular' ? 'מחיר רגיל' : option.label;
  } else {
    units = discountUnits;
    actual = r2(Number(actualPrice) || 0);
    kind = 'discount';
    optionLabel = 'הנחה';
  }
  const full = fullPriceFor(item, units);
  return {
    itemId: item.id,
    itemName: item.name,
    category: item.category,
    unit: item.unit || '',
    units,
    optionLabel,
    kind,
    fullPrice: full,
    actualPrice: actual,
    discount: r2(Math.max(full - actual, 0)),
    status: 'active',
  };
}

function emptyTotals() {
  return { brought: 0, sold: 0, left: 0, target: 0, full: 0, actual: 0, discount: 0, leftValue: 0, salesCount: 0 };
}

function addInto(t, s) {
  for (const k of Object.keys(t)) t[k] = r2(t[k] + (s[k] || 0));
}

/**
 * סיכום דוכן ליום: לפי פריט, לפי קטגוריה, וסה"כ.
 * מכירות שבוטלו (status: 'void') לא נספרות.
 */
export function summarizeStand(items = [], sales = []) {
  const active = sales.filter((s) => s.status !== 'void');
  const byItem = {};
  for (const it of items) {
    byItem[it.id] = {
      id: it.id, name: it.name, category: it.category, unit: it.unit, price: Number(it.price) || 0,
      ...emptyTotals(), brought: Number(it.qty) || 0, target: itemTarget(it),
    };
  }
  for (const s of active) {
    let row = byItem[s.itemId];
    if (!row) {
      // מוצר שנמחק אחרי שנמכר — עדיין נספר בכסף
      row = byItem[s.itemId] = { id: s.itemId, name: s.itemName, category: s.category, unit: s.unit, price: 0, ...emptyTotals() };
    }
    row.sold = r2(row.sold + s.units);
    row.full = r2(row.full + s.fullPrice);
    row.actual = r2(row.actual + s.actualPrice);
    row.discount = r2(row.discount + s.discount);
    row.salesCount += 1;
  }
  const rows = Object.values(byItem);
  for (const row of rows) {
    row.left = r2(Math.max(row.brought - row.sold, 0));
    row.leftValue = r2(row.left * row.price);
    row.avgPrice = row.sold ? r2(row.actual / row.sold) : 0;
    row.sellThrough = row.brought ? row.sold / row.brought : 0;
  }

  const byCategory = { flower: emptyTotals(), fruit: emptyTotals() };
  const total = emptyTotals();
  for (const row of rows) {
    const cat = byCategory[row.category] || (byCategory[row.category] = emptyTotals());
    addInto(cat, row);
    addInto(total, row);
  }
  for (const t of [...Object.values(byCategory), total]) finalize(t);

  return { items: rows, byCategory, total, corrections: sales.filter((s) => s.status === 'void').length };
}

function finalize(t) {
  t.toTarget = r2(Math.max(t.target - t.actual, 0));
  t.targetPct = t.target ? t.actual / t.target : 0;
  t.sellThrough = t.brought ? t.sold / t.brought : 0;
  t.avgPrice = t.sold ? r2(t.actual / t.sold) : 0;
  // פער מהיעד = הנחות + שווי הסחורה שנשארה
  t.gap = r2(t.target - t.actual);
  return t;
}

/** מאחד כמה סיכומי דוכנים לסיכום כולל */
export function combineSummaries(summaries) {
  const total = emptyTotals();
  const byCategory = { flower: emptyTotals(), fruit: emptyTotals() };
  for (const s of summaries) {
    addInto(total, s.total);
    for (const c of Object.keys(byCategory)) addInto(byCategory[c], s.byCategory[c] || {});
  }
  finalize(total);
  Object.values(byCategory).forEach(finalize);
  return { total, byCategory };
}

/** צבע סטטוס לפי אחוז מהיעד */
export function progressStatus(pct) {
  if (pct >= 0.75) return 'good';
  if (pct >= 0.4) return 'mid';
  return 'low';
}

/** פריטים שמתקרבים לסוף המלאי */
export function lowStock(summary, threshold = 0.2) {
  return summary.items.filter((r) => r.brought > 0 && r.left > 0 && r.left / r.brought <= threshold);
}
