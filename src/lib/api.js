// בוחר שכבת נתונים: Firebase אם הוגדר ב-.env, אחרת מצב הדגמה
import { api as demoApi } from './api.demo.js';

export const DEMO = import.meta.env.VITE_DEMO === '1' || !import.meta.env.VITE_FIREBASE_API_KEY;

export const api = DEMO ? demoApi : (await import('./api.firebase.js')).api;
