// מצב הדגמה: נתונים בזיכרון בלבד (מתאפסים ברענון). פועל כשאין הגדרות Firebase.
import { buildSale, saleOptions } from './calc.js';
import { toDayId, nextFriday, uid as rid } from './format.js';

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const sub = (compute, cb) => {
  const fn = () => cb(structuredClone(compute()));
  listeners.add(fn);
  queueMicrotask(fn);
  return () => listeners.delete(fn);
};

const S = {
  users: {
    admin: { id: 'admin', name: 'מנהל (הדגמה)', username: 'admin', role: 'admin', active: true },
    w1: { id: 'w1', name: 'דנה', username: 'dana', role: 'worker', standId: 'stand1', active: true },
    w2: { id: 'w2', name: 'יוסי', username: 'yossi', role: 'worker', standId: 'stand2', active: true },
    w3: { id: 'w3', name: 'מיכל', username: 'michal', role: 'worker', standId: 'stand3', active: true },
    w4: { id: 'w4', name: 'אבי', username: 'avi', role: 'worker', standId: 'stand4', active: true },
  },
  stands: {
    stand1: { id: 'stand1', name: 'דוכן 1', hasFruit: false, order: 1, active: true },
    stand2: { id: 'stand2', name: 'דוכן 2', hasFruit: false, order: 2, active: true },
    stand3: { id: 'stand3', name: 'דוכן 3', hasFruit: true, order: 3, active: true },
    stand4: { id: 'stand4', name: 'דוכן 4', hasFruit: true, order: 4, active: true },
  },
  settings: {},
  days: {}, // dayId -> { date, stands: { standId: { items, status, ... , sales: {id: sale} } } }
  authUid: null,
};

const flowers = (a, b, c) => [
  { id: 'f60', name: 'זר 60', category: 'flower', unit: 'זר', qty: a, price: 60, options: [] },
  { id: 'f70', name: 'זר 70', category: 'flower', unit: 'זר', qty: b, price: 70, options: [{ id: 'p1', label: 'מבצע 65', units: 1, price: 65 }] },
  { id: 'f80', name: 'זר 80', category: 'flower', unit: 'זר', qty: c, price: 80, options: [{ id: 'p2', label: '2 ב-150', units: 2, price: 150 }] },
];
const fruit = () => [
  { id: 'straw', name: 'תותים', category: 'fruit', unit: 'מארז', qty: 10, price: 20, options: [{ id: 'o1', label: '2 ב-35', units: 2, price: 35 }, { id: 'o2', label: '3 ב-50', units: 3, price: 50 }] },
  { id: 'grape', name: 'ענבים', category: 'fruit', unit: 'ק"ג', qty: 10, price: 25, options: [{ id: 'o3', label: '2 ק"ג ב-40', units: 2, price: 40 }] },
  { id: 'pine', name: 'אננס', category: 'fruit', unit: 'יחידה', qty: 5, price: 15, options: [{ id: 'o4', label: '2 ב-25', units: 2, price: 25 }] },
];

function seedDay(dayId, intensity, closed) {
  const setup = {
    stand1: flowers(20, 15, 10), stand2: flowers(15, 20, 10),
    stand3: [...flowers(25, 15, 0).filter((i) => i.qty), ...fruit()],
    stand4: [...flowers(20, 20, 10), ...fruit()],
  };
  const day = { date: dayId, stands: {} };
  let seed = dayId.split('-').reduce((a, b) => a * 31 + Number(b), 7);
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const base = new Date(dayId + 'T07:30:00').getTime();
  Object.entries(setup).forEach(([sid, items]) => {
    const sales = {};
    const soldU = {};
    const count = Math.round(items.reduce((a, i) => a + i.qty, 0) * intensity * (0.8 + rnd() * 0.3));
    for (let n = 0; n < count; n++) {
      const item = items[Math.floor(rnd() * items.length)];
      const opts = saleOptions(item);
      const roll = rnd();
      const sale = roll < 0.12
        ? buildSale(item, { option: null, actualPrice: item.price - (rnd() < 0.5 ? 5 : 10) })
        : buildSale(item, { option: roll < 0.3 && opts[1] ? opts[1] : opts[0] });
      if ((soldU[item.id] || 0) + sale.units > item.qty) continue;
      soldU[item.id] = (soldU[item.id] || 0) + sale.units;
      const w = Object.values(S.users).find((u) => u.standId === sid);
      const id = rid();
      sales[id] = { id, ...sale, createdAt: base + n * (5.5 * 3600e3 / count), createdBy: w.id, createdByName: w.name };
    }
    const vals = Object.values(sales);
    if (vals.length > 3) {
      const bad = vals[2];
      const fixed = { ...bad, id: rid(), correctionOf: bad.id, createdAt: bad.createdAt + 60e3 };
      Object.assign(bad, { status: 'void', voidReason: 'הוזן מחיר שגוי', voidedAt: bad.createdAt + 60e3, voidedByName: bad.createdByName, replacedBy: fixed.id, actualPrice: bad.actualPrice + 10, fullPrice: bad.fullPrice + 10 });
      sales[fixed.id] = fixed;
    }
    day.stands[sid] = { items, status: closed ? 'closed' : 'open', sales,
      ...(closed ? { closedAt: base + 7 * 3600e3, closedByName: Object.values(S.users).find((u) => u.standId === sid).name, cashCounted: null } : {}) };
  });
  S.days[dayId] = day;
}

// שלושה ימי שישי קודמים סגורים + היום הפעיל באמצע מכירות
const fri = nextFriday();
const d0 = new Date(fri);
for (let w = 3; w >= 1; w--) {
  const d = new Date(d0); d.setDate(d.getDate() - 7 * w);
  seedDay(toDayId(d), 0.75 + w * 0.05, true);
}
seedDay(fri, 0.55, false);
S.settings.activeDayId = fri;

const me = () => S.users[S.authUid];
const sd = (dayId, standId) => S.days[dayId]?.stands?.[standId];
const authCbs = new Set();

export const api = {
  demo: true,
  demoUsers: () => Object.values(S.users),
  demoLogin: (id) => { S.authUid = id; authCbs.forEach((cb) => cb({ uid: id })); },

  onAuth: (cb) => { authCbs.add(cb); queueMicrotask(() => cb(S.authUid ? { uid: S.authUid } : null)); return () => authCbs.delete(cb); },
  login: async (u) => {
    const found = Object.values(S.users).find((x) => x.username === u.toLowerCase());
    if (!found) throw new Error('auth/invalid-credential');
    api.demoLogin(found.id);
  },
  logout: async () => { S.authUid = null; authCbs.forEach((cb) => cb(null)); },
  isBootstrapped: async () => true,
  bootstrapAdmin: async () => {},
  watchProfile: (id, cb) => sub(() => S.users[id] || null, cb),

  watchSettings: (cb) => sub(() => S.settings, cb),
  setActiveDay: async (d) => { S.settings.activeDayId = d; emit(); },
  watchDays: (cb) => sub(() => Object.keys(S.days).sort().reverse().map((id) => ({ id, date: id })), cb),
  createDay: async (dayId, copyFrom) => {
    if (!S.days[dayId]) S.days[dayId] = { date: dayId, stands: {} };
    if (copyFrom && S.days[copyFrom]) {
      Object.entries(S.days[copyFrom].stands).forEach(([sid, st]) => {
        S.days[dayId].stands[sid] = { items: structuredClone(st.items), status: 'open', sales: {} };
      });
    }
    emit();
  },

  watchStands: (cb) => sub(() => Object.values(S.stands).sort((a, b) => a.order - b.order), cb),
  watchStand: (id, cb) => sub(() => S.stands[id] || null, cb),
  saveStand: async ({ id, ...data }) => { S.stands[id] = { ...(S.stands[id] || {}), id, ...data }; emit(); },

  watchStandDay: (dayId, standId, cb) => sub(() => {
    const s = sd(dayId, standId);
    if (!s) return null;
    const { sales, ...rest } = s;
    return { id: standId, ...rest };
  }, cb),
  saveItems: async (dayId, standId, items) => {
    if (!S.days[dayId]) S.days[dayId] = { date: dayId, stands: {} };
    const cur = S.days[dayId].stands[standId] || { status: 'open', sales: {} };
    S.days[dayId].stands[standId] = { ...cur, items };
    emit();
  },
  closeStand: async (dayId, standId, { cashCounted, note }) => {
    Object.assign(sd(dayId, standId), { status: 'closed', closedAt: Date.now(), closedByName: me().name,
      cashCounted: cashCounted === '' || cashCounted == null ? null : Number(cashCounted), closeNote: note || '' });
    emit();
  },
  reopenStand: async (dayId, standId) => { sd(dayId, standId).status = 'open'; emit(); },

  watchSales: (dayId, standId, cb) => sub(() => Object.values(sd(dayId, standId)?.sales || {}), cb),
  addSale: async (dayId, standId, sale) => {
    const id = rid();
    sd(dayId, standId).sales[id] = { id, ...sale, createdAt: Date.now(), createdBy: me().id, createdByName: me().name };
    emit();
    return id;
  },
  voidSale: async (dayId, standId, saleId, reason) => {
    Object.assign(sd(dayId, standId).sales[saleId], { status: 'void', voidedAt: Date.now(), voidedByName: me().name, voidReason: reason || '' });
    emit();
  },
  correctSale: async (dayId, standId, saleId, newSale, reason) => {
    const id = rid();
    Object.assign(sd(dayId, standId).sales[saleId], { status: 'void', voidedAt: Date.now(), voidedByName: me().name, voidReason: reason || 'תיקון', replacedBy: id });
    sd(dayId, standId).sales[id] = { id, ...newSale, correctionOf: saleId, createdAt: Date.now(), createdBy: me().id, createdByName: me().name };
    emit();
  },

  watchUsers: (cb) => sub(() => Object.values(S.users), cb),
  createUser: async ({ name, username, role, standId }) => {
    const id = rid();
    S.users[id] = { id, name, username, role, standId: role === 'worker' ? standId : null, active: true };
    emit();
  },
  updateUser: async (id, patch) => { Object.assign(S.users[id], patch); emit(); },
};
