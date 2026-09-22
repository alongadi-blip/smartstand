import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { progressStatus } from './lib/calc.js';
import { pct } from './lib/format.js';

export const UserCtx = createContext(null);
export const useUser = () => useContext(UserCtx);

export function Sheet({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className={'sheet' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="סגירה">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }) {
  return (
    <div className={'stat' + (tone ? ' ' + tone : '')}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub != null && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

export function Progress({ value, label = true }) {
  const st = progressStatus(value);
  return (
    <div className="progress-wrap">
      <div className={'progress ' + st}>
        <span style={{ width: Math.min(value * 100, 100) + '%' }} />
      </div>
      {label && <span className="progress-label">{pct(value)}</span>}
    </div>
  );
}

const STATUS_TEXT = { good: 'בקצב טוב', mid: 'בדרך', low: 'מתחת לקצב' };
export function StatusChip({ value, closed }) {
  if (closed) return <span className="chip closed">נסגר</span>;
  const st = progressStatus(value);
  return <span className={'chip ' + st}>{STATUS_TEXT[st]}</span>;
}

// הודעות קופצות עם כפתור פעולה (למשל "ביטול")
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }) {
  const [t, setT] = useState(null);
  const show = useCallback((msg, action) => {
    const id = Math.random();
    setT({ id, msg, action });
    setTimeout(() => setT((cur) => (cur?.id === id ? null : cur)), action ? 6000 : 2500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && (
        <div className="toast" role="status">
          <span>{t.msg}</span>
          {t.action && <button onClick={() => { t.action.fn(); setT(null); }}>{t.action.label}</button>}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}
