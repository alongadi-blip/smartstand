import { describe, it, expect } from 'vitest';
import { buildSale, summarizeStand, saleOptions, combineSummaries } from './calc.js';

const bouquet70 = { id: 'b70', name: 'זר 70', category: 'flower', unit: 'זר', qty: 10, price: 70, options: [] };
const straw = { id: 's', name: 'תותים', category: 'fruit', unit: 'מארז', qty: 10, price: 20,
  options: [{ id: 'o2', label: '2 ב-35', units: 2, price: 35 }, { id: 'o3', label: '3 ב-50', units: 3, price: 50 }] };

describe('מכירות והנחות', () => {
  it('דוגמת האפיון: 10 זרים × 70, בפועל 650 → הנחות 50', () => {
    const sales = [];
    for (let i = 0; i < 9; i++) sales.push(buildSale(bouquet70, { option: saleOptions(bouquet70)[0] }));
    sales.push(buildSale(bouquet70, { option: null, actualPrice: 20 }));
    const s = summarizeStand([bouquet70], sales);
    expect(s.total.full).toBe(700);
    expect(s.total.actual).toBe(650);
    expect(s.total.discount).toBe(50);
    expect(s.total.sold).toBe(10);
    expect(s.total.left).toBe(0);
  });

  it('מבצע 2 ב-35 נספר כשתי יחידות והנחה של 5', () => {
    const sale = buildSale(straw, { option: saleOptions(straw)[1] });
    expect(sale.units).toBe(2);
    expect(sale.fullPrice).toBe(40);
    expect(sale.actualPrice).toBe(35);
    expect(sale.discount).toBe(5);
  });

  it('מכירה שבוטלה לא נספרת, והתיקון כן', () => {
    const wrong = { ...buildSale(bouquet70, { option: saleOptions(bouquet70)[0] }), status: 'void' };
    const fixed = buildSale(bouquet70, { option: saleOptions(bouquet70)[0] });
    const s = summarizeStand([bouquet70], [wrong, fixed]);
    expect(s.total.sold).toBe(1);
    expect(s.total.actual).toBe(70);
    expect(s.corrections).toBe(1);
  });

  it('יעד, נשאר ליעד ואחוז — דוגמת 6,500 / 4,200', () => {
    const item = { id: 'x', name: 'זר', category: 'flower', qty: 100, price: 65, options: [] };
    const sales = [buildSale(item, { option: null, actualPrice: 4200, discountUnits: 60 })];
    const s = summarizeStand([item], sales);
    expect(s.total.target).toBe(6500);
    expect(s.total.toTarget).toBe(2300);
    expect(Math.round(s.total.targetPct * 1000) / 10).toBe(64.6);
  });

  it('פירות ופרחים מסוכמים בנפרד וגם יחד', () => {
    const sales = [
      buildSale(bouquet70, { option: saleOptions(bouquet70)[0], times: 2 }),
      buildSale(straw, { option: saleOptions(straw)[2] }),
    ];
    const s = summarizeStand([bouquet70, straw], sales);
    expect(s.byCategory.flower.actual).toBe(140);
    expect(s.byCategory.fruit.actual).toBe(50);
    expect(s.byCategory.fruit.sold).toBe(3);
    expect(s.total.actual).toBe(190);
    const all = combineSummaries([s, s]);
    expect(all.total.actual).toBe(380);
    expect(all.byCategory.flower.sold).toBe(4);
  });
});

describe('רווח', () => {
  const withCost = { ...bouquet70, cost: 40 };

  it('רווח = הכנסות פחות העלות של מה שנמכר בלבד', () => {
    const sales = [buildSale(withCost, { option: saleOptions(withCost)[0], times: 4 })];
    const s = summarizeStand([withCost], sales);
    expect(s.total.stockCost).toBe(400); // 10 זרים × 40 — מה שהושקע
    expect(s.total.cost).toBe(160);      // רק 4 נמכרו
    expect(s.total.actual).toBe(280);
    expect(s.total.profit).toBe(120);
    expect(Math.round(s.total.margin * 100)).toBe(43);
  });

  it('מכירה מתחת לעלות מכניסה את הרווח למינוס', () => {
    const s = summarizeStand([withCost], [buildSale(withCost, { option: null, actualPrice: 30 })]);
    expect(s.total.cost).toBe(40);
    expect(s.total.profit).toBe(-10);
  });

  it('בלי עלות — hasCost כבוי והרווח שווה להכנסות', () => {
    const s = summarizeStand([bouquet70], [buildSale(bouquet70, { option: saleOptions(bouquet70)[0] })]);
    expect(s.hasCost).toBe(false);
    expect(s.total.cost).toBe(0);
    expect(s.total.profit).toBe(70);
  });

  it('עלויות מצטברות בין דוכנים', () => {
    const s = summarizeStand([withCost], [buildSale(withCost, { option: saleOptions(withCost)[0] })]);
    const all = combineSummaries([s, s]);
    expect(all.total.cost).toBe(80);
    expect(all.total.profit).toBe(60);
    expect(all.hasCost).toBe(true);
  });
});
