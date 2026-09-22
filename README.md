# ניהול דוכנים — SmartStand

אפליקציית PWA בעברית (RTL) למעקב בזמן אמת אחרי מכירות ב-4 דוכני פרחים/פירות.
React + Vite + Firebase (Auth + Firestore), עם שמירה אופליין: מכירה שנרשמת בלי קליטה מסתנכרנת כשהרשת חוזרת.

## מה יש בגרסה 1 (ליבה)
- **עובד דוכן** (מסך טלפון, כפתורים גדולים): מכירה ב-2 לחיצות (מוצר ← מחיר רגיל / מבצע / הנחה), כמות, "ביטול" מיידי, רשימת מכירות עם תיקון/ביטול, סגירת דוכן עם דוח וספירת קופה.
- **מנהל**: לוח בקרה חי (סה"כ, יעד, נשאר ליעד, זרים, פירות, הנחות, צבע סטטוס לכל דוכן, התראת מלאי נמוך), פירוט לפי מוצר, הזנת סחורה ומחירים ומבצעים, פתיחת יום חדש עם העתקה מהשבוע הקודם, יומן מכירות עם כל התיקונים, היסטוריה לפי תאריך, ניהול עובדים ודוכנים.
- **הרשאות** נאכפות בשרת (`firestore.rules`): עובד רואה רק את הדוכן שלו; מכירות לא נמחקות לעולם — תיקון מסמן את המקור כ"בוטל" ויוצר מכירה חדשה שמפנה אליו.

## הגדרות החישוב
| מונח | חישוב |
|---|---|
| יעד | כמות × מחיר רגיל, לכל המוצרים בדוכן |
| מחיר מלא של מכירה | יחידות × מחיר רגיל |
| הנחה | מחיר מלא − מחיר בפועל (מבצע "2 ב-35" על תות של 20 = הנחה של 5) |
| נשאר ליעד | יעד − הכנסות בפועל |
| פער מהיעד | הנחות + שווי הסחורה שנשארה |

## הרצה מקומית (מצב הדגמה)
```bash
npm install
npm run dev        # בלי .env.local → עולה עם נתוני הדגמה
npm test           # בדיקות החישובים
```

## חיבור ל-Firebase ופריסה
1. [console.firebase.google.com](https://console.firebase.google.com) → פרויקט חדש.
2. **Authentication** → Sign-in method → להפעיל **Email/Password**.
3. **Firestore Database** → Create database (Production mode, אזור `eur3` או `me-west1`).
4. Project settings → Your apps → **Web app** → להעתיק את ה-config לקובץ `.env.local` (תבנית ב-`.env.example`).
5. התקנת הכלים והפריסה:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use --add          # לבחור את הפרויקט
   firebase deploy --only firestore:rules
   npm run deploy              # build + hosting
   ```
6. לפתוח את האתר → מסך **הגדרה ראשונית** → ליצור את חשבון המנהל (מופיע פעם אחת בלבד). נוצרים גם 4 הדוכנים.
7. בלשונית **צוות ודוכנים** ליצור משתמש לכל עובד (שם משתמש + סיסמה של 6 תווים לפחות) ולשייך לדוכן.
8. **+ יום חדש** → **סחורה ומחירים** → להזין לכל דוכן. העובדים רואים את השינוי מיד.

בטלפון של העובד: לפתוח את הקישור בדפדפן → "הוספה למסך הבית" — ייפתח כאפליקציה.

## מבנה הנתונים
```
users/{uid}                    name, username, role: admin|worker, standId, active
stands/{standId}               name, hasFruit, order, active
meta/settings                  activeDayId
days/{YYYY-MM-DD}/stands/{id}  items[], status: open|closed, cashCounted, closedAt…
  └ sales/{saleId}             itemId, units, fullPrice, actualPrice, discount, kind,
                               status: active|void, correctionOf, replacedBy, voidReason…
```
כל מוצר: `{ id, name, category: flower|fruit, unit, qty, price, options: [{label, units, price}] }`.

## הרחבות מתוכננות (שלב 2)
המבנה כבר תומך בהן בלי שינוי נתונים:
- דוח שבועי/חודשי והשוואה בין דוכנים וימים (גרפים) — אגרגציה על `days/*`.
- רווח: הוספת שדה `cost` למוצר; החישוב ב-`src/lib/calc.js`.
- התראות מלאי כהודעת Push (Cloud Function על `sales`).
- עוד דוכנים/עובדים/מוצרים — כבר אפשרי מהממשק.

## קבצים
- `src/lib/calc.js` — כל החישובים (עם בדיקות ב-`calc.test.js`)
- `src/lib/api.firebase.js` / `api.demo.js` — שכבת נתונים אמיתית / הדגמה
- `src/worker/` — מסך העובד · `src/admin/` — מסכי המנהל · `src/report/` — דוח סגירה
- `firestore.rules` — הרשאות
