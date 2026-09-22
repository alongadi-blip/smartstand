import { useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { summarizeStand } from './calc.js';

/** מנוי לזרם נתונים בזמן אמת. deps ריקים/חסרים → לא מאזין. */
export function useWatch(fnName, args) {
  const [state, setState] = useState({ data: undefined, loading: true });
  const key = JSON.stringify(args);
  useEffect(() => {
    if (!args || args.some((a) => a == null)) { setState({ data: undefined, loading: false }); return; }
    setState((s) => ({ ...s, loading: true }));
    return api[fnName](...args, (data, error) => setState({ data, loading: false, error }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fnName, key]);
  return state;
}

const EMPTY = [];

/** מנוי לכל הדוכנים ביום נתון (לדשבורד המנהל) */
export function useAllStandDays(dayId, stands) {
  const [data, setData] = useState({});
  const ids = stands.map((s) => s.id).join(',');
  useEffect(() => {
    if (!dayId) return;
    setData({});
    const put = (sid, k) => (v) => setData((d) => ({ ...d, [sid]: { ...(d[sid] || {}), [k]: v } }));
    const unsubs = stands.flatMap((s) => [
      api.watchStandDay(dayId, s.id, put(s.id, 'standDay')),
      api.watchSales(dayId, s.id, put(s.id, 'sales')),
    ]);
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId, ids]);
  return useMemo(() => stands.map((s) => {
    const d = data[s.id] || {};
    return {
      stand: s, standDay: d.standDay, sales: d.sales || [],
      summary: summarizeStand(d.standDay?.items || [], d.sales || []),
      loaded: d.standDay !== undefined && d.sales !== undefined,
    };
  }), [data, stands]);
}

/** כל נתוני דוכן ליום: סחורה, מכירות וסיכום */
export function useStandDay(dayId, standId) {
  const day = useWatch('watchStandDay', [dayId, standId]);
  const sales = useWatch('watchSales', [dayId, standId]);
  const items = day.data?.items || EMPTY;
  const list = sales.data || EMPTY;
  const summary = useMemo(() => summarizeStand(items, list), [items, list]);
  return {
    loading: day.loading || sales.loading,
    standDay: day.data,
    items,
    sales: list,
    summary,
  };
}
