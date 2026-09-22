// שכבת נתונים — Firebase (Auth + Firestore, עם שמירה אופליין)
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, updateProfile,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, collection, getDoc, getDocs, setDoc, updateDoc, onSnapshot, writeBatch,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { USER_DOMAIN, toEmail } from './format.js';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(config);
const auth = getAuth(app);
// מטמון מקומי: מכירות נשמרות גם בלי קליטה ומסתנכרנות כשהרשת חוזרת
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const withId = (d) => ({ id: d.id, ...d.data() });
const listen = (ref, cb, map = withId) =>
  onSnapshot(ref, (snap) => cb(snap.docs ? snap.docs.map(map) : snap.exists() ? map(snap) : null),
    (err) => { console.error(err); cb(null, err); });

const standDayRef = (dayId, standId) => doc(db, 'days', dayId, 'stands', standId);
const salesCol = (dayId, standId) => collection(db, 'days', dayId, 'stands', standId, 'sales');

export const api = {
  demo: false,

  // ---------- התחברות ----------
  onAuth: (cb) => onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null)),
  login: (user, pass) => signInWithEmailAndPassword(auth, toEmail(user), pass),
  logout: () => signOut(auth),

  async isBootstrapped() {
    const s = await getDoc(doc(db, 'meta', 'bootstrap'));
    return s.exists();
  },

  /** יצירת חשבון המנהל הראשון + 4 הדוכנים. אפשרי פעם אחת בלבד (נאכף בכללי האבטחה). */
  async bootstrapAdmin({ name, email, password }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });
    const b = writeBatch(db);
    b.set(doc(db, 'users', cred.user.uid), { name, username: email, role: 'admin', active: true, createdAt: Date.now() });
    b.set(doc(db, 'meta', 'bootstrap'), { by: cred.user.uid, at: Date.now() });
    await b.commit();
    const s = writeBatch(db);
    [
      { id: 'stand1', name: 'דוכן 1', hasFruit: false, order: 1 },
      { id: 'stand2', name: 'דוכן 2', hasFruit: false, order: 2 },
      { id: 'stand3', name: 'דוכן 3', hasFruit: true, order: 3 },
      { id: 'stand4', name: 'דוכן 4', hasFruit: true, order: 4 },
    ].forEach(({ id, ...st }) => s.set(doc(db, 'stands', id), { ...st, active: true }));
    await s.commit();
  },

  watchProfile: (uid, cb) => listen(doc(db, 'users', uid), cb),

  // ---------- הגדרות וימים ----------
  watchSettings: (cb) => listen(doc(db, 'meta', 'settings'), (d) => cb(d || {})),
  setActiveDay: (dayId) => setDoc(doc(db, 'meta', 'settings'), { activeDayId: dayId }, { merge: true }),
  watchDays: (cb) => listen(query(collection(db, 'days'), orderBy('date', 'desc')), cb),

  /** פתיחת יום חדש. אם copyFrom — מעתיק את הסחורה והמחירים של כל דוכן מאותו יום. */
  async createDay(dayId, copyFrom) {
    const b = writeBatch(db);
    b.set(doc(db, 'days', dayId), { date: dayId, createdAt: Date.now() }, { merge: true });
    if (copyFrom) {
      const prev = await getDocs(collection(db, 'days', copyFrom, 'stands'));
      prev.forEach((d) => b.set(standDayRef(dayId, d.id), { items: d.data().items || [], status: 'open' }));
    }
    await b.commit();
  },

  /**
   * קריאה חד-פעמית של כל הימים בטווח, עם הסחורה והמכירות של כל דוכן — לדוחות.
   * החזרה: [{ id, date, stands: [{ standId, items, sales, status… }] }] לפי סדר התאריכים.
   */
  async loadRange(fromDayId, toDayId) {
    const days = await getDocs(query(
      collection(db, 'days'),
      where('date', '>=', fromDayId), where('date', '<=', toDayId), orderBy('date'),
    ));
    return Promise.all(days.docs.map(async (d) => {
      const stands = await getDocs(collection(db, 'days', d.id, 'stands'));
      return {
        id: d.id, ...d.data(),
        stands: await Promise.all(stands.docs.map(async (sd) => ({
          standId: sd.id, ...sd.data(),
          sales: (await getDocs(salesCol(d.id, sd.id))).docs.map(withId),
        }))),
      };
    }));
  },

  // ---------- דוכנים ----------
  watchStands: (cb) => listen(query(collection(db, 'stands'), orderBy('order')), cb),
  watchStand: (id, cb) => listen(doc(db, 'stands', id), cb),
  saveStand: ({ id, ...data }) => setDoc(doc(db, 'stands', id), data, { merge: true }),

  // ---------- סחורה ליום ----------
  watchStandDay: (dayId, standId, cb) => listen(standDayRef(dayId, standId), cb),
  async saveItems(dayId, standId, items) {
    const b = writeBatch(db);
    b.set(doc(db, 'days', dayId), { date: dayId }, { merge: true });
    b.set(standDayRef(dayId, standId), { items, updatedAt: Date.now() }, { merge: true });
    const cur = await getDoc(standDayRef(dayId, standId)).catch(() => null);
    if (!cur || !cur.exists() || !cur.data().status) b.set(standDayRef(dayId, standId), { status: 'open' }, { merge: true });
    await b.commit();
  },
  closeStand: (dayId, standId, { cashCounted, note }, user) =>
    updateDoc(standDayRef(dayId, standId), {
      status: 'closed', closedAt: Date.now(), closedBy: user.uid, closedByName: user.name,
      cashCounted: cashCounted === '' || cashCounted == null ? null : Number(cashCounted), closeNote: note || '',
    }),
  reopenStand: (dayId, standId) => updateDoc(standDayRef(dayId, standId), { status: 'open' }),

  // ---------- מכירות ----------
  watchSales: (dayId, standId, cb) => listen(salesCol(dayId, standId), cb),
  async addSale(dayId, standId, sale, user) {
    const ref = doc(salesCol(dayId, standId));
    await setDoc(ref, { ...sale, createdAt: Date.now(), serverAt: serverTimestamp(), createdBy: user.uid, createdByName: user.name });
    return ref.id;
  },
  voidSale: (dayId, standId, saleId, reason, user) =>
    updateDoc(doc(salesCol(dayId, standId), saleId), {
      status: 'void', voidedAt: Date.now(), voidedBy: user.uid, voidedByName: user.name, voidReason: reason || '',
    }),
  /** תיקון = ביטול המכירה המקורית + מכירה חדשה שמצביעה עליה. שום נתון לא נמחק. */
  async correctSale(dayId, standId, saleId, newSale, reason, user) {
    const b = writeBatch(db);
    const ref = doc(salesCol(dayId, standId));
    b.update(doc(salesCol(dayId, standId), saleId), {
      status: 'void', voidedAt: Date.now(), voidedBy: user.uid, voidedByName: user.name,
      voidReason: reason || 'תיקון', replacedBy: ref.id,
    });
    b.set(ref, { ...newSale, correctionOf: saleId, createdAt: Date.now(), serverAt: serverTimestamp(), createdBy: user.uid, createdByName: user.name });
    await b.commit();
  },

  // ---------- משתמשים ----------
  watchUsers: (cb) => listen(collection(db, 'users'), cb),
  /** יצירת עובד דרך מופע Firebase משני — כדי שהמנהל לא יתנתק */
  async createUser({ name, username, password, role, standId }) {
    const tmp = initializeApp(config, 'create-' + Date.now());
    try {
      const cred = await createUserWithEmailAndPassword(getAuth(tmp), toEmail(username), password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        name, username: username.includes('@') ? username : username.toLowerCase(),
        role, standId: role === 'worker' ? standId : null, active: true, createdAt: Date.now(),
      });
    } finally {
      await deleteApp(tmp);
    }
  },
  updateUser: (uid, patch) => updateDoc(doc(db, 'users', uid), patch),
};

export { USER_DOMAIN };
