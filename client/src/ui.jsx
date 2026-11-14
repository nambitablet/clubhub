import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  Atom, Bike, Binary, Bot, Car, CheckCircle2, Cloud, Code2, Cpu, Flame, Gauge, Globe, Lightbulb, Mountain, Navigation, Plane, Radio, Rocket,
  Sparkles, Telescope, Tractor, X, Zap, AlertCircle, Music, Camera, Palette, BookOpen, Heart, Trophy, Users, Leaf, FlaskConical, Inbox,
} from 'lucide-react';

export const ICONS = { car: Car, telescope: Telescope, radio: Radio, rocket: Rocket, bot: Bot, zap: Zap, plane: Plane, lightbulb: Lightbulb, atom: Atom, bike: Bike, code: Code2, cpu: Cpu, gauge: Gauge, navigation: Navigation, tractor: Tractor, mountain: Mountain, flame: Flame, globe: Globe, cloud: Cloud, binary: Binary, sparkles: Sparkles, music: Music, camera: Camera, palette: Palette, book: BookOpen, heart: Heart, trophy: Trophy, users: Users, leaf: Leaf, flask: FlaskConical };

export const clubVars = (c) => (c ? { '--c1': c.color || '#4f46e5', '--c2': c.color2 || '#8b5cf6' } : {});

export function ClubLogo({ club, size = '', className = '' }) {
  const I = ICONS[club?.icon] || Sparkles;
  const px = { xs: 14, sm: 17, '': 22, lg: 38 }[size] ?? 22;
  return <div className={`club-logo ${size} ${className}`} style={clubVars(club)} aria-hidden><I size={px} strokeWidth={2.2} /></div>;
}

const AV = [['#4f46e5', '#8b5cf6'], ['#0891b2', '#22c55e'], ['#db2777', '#f97316'], ['#7c3aed', '#ec4899'], ['#0f766e', '#84cc16'], ['#b45309', '#f59e0b'], ['#1d4ed8', '#06b6d4']];
export function Avatar({ name = '?', size = '' }) {
  const i = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV.length;
  const initials = name.replace(/^Dr\.?\s+/, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return <div className={`avatar ${size}`} style={{ '--c1': AV[i][0], '--c2': AV[i][1] }}>{initials}</div>;
}

export const fmtDate = (d, o = {}) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', ...o });
export const fmtTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
export const fmtDT = (d) => `${fmtDate(d, { weekday: 'short' })} · ${fmtTime(d)}`;
export const fmtRange = (a, b) => {
  const s = new Date(a); const e = new Date(b);
  return s.toDateString() === e.toDateString() ? `${fmtTime(s)} – ${fmtTime(e)}` : `${fmtDate(s, { year: undefined })}, ${fmtTime(s)} → ${fmtDate(e, { year: undefined })}, ${fmtTime(e)}`;
};
export const toLocalInput = (d) => { if (!d) return ''; const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
export const relTime = (d) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  const f = (n, u) => `${Math.round(n)} ${u}${Math.round(n) === 1 ? '' : 's'}`;
  const fut = s < 0; const a = Math.abs(s);
  const t = a < 60 ? 'just now' : a < 3600 ? f(a / 60, 'min') : a < 86400 ? f(a / 3600, 'hour') : a < 86400 * 30 ? f(a / 86400, 'day') : fmtDate(d);
  if (t === 'just now' || a >= 86400 * 30) return t;
  return fut ? `in ${t}` : `${t} ago`;
};
export const yearLabel = (y) => (y ? `${y}${['th', 'st', 'nd', 'rd'][y] || 'th'} year` : '');
export const BRANCHES = { CS: 'Computer Science', IS: 'Information Science', EC: 'Electronics & Comm.', EE: 'Electrical & Electronics', ME: 'Mechanical', AS: 'Aerospace', CV: 'Civil', BT: 'Biotechnology', CH: 'Chemical', IM: 'Industrial Eng. & Mgmt.', ET: 'Electronics & Telecom.', AI: 'AI & ML', CD: 'CSE (Data Science)', CY: 'CSE (Cyber Security)' };

export const REG_STATE = {
  open: ['Registration open', 'ok'], waitlist: ['Full · Waitlist open', 'warn'], full: ['Fully booked', 'bad'], closed: ['Registration closed', ''],
  ended: ['Event ended', ''], cancelled: ['Cancelled', 'bad'], draft: ['Draft', 'info'],
};

export function Modal({ title, sub, onClose, children, foot, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k); document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div><h2 style={{ fontSize: 20 }}>{title}</h2>{sub && <p className="muted small mt-8" style={{ marginTop: 4 }}>{sub}</p>}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, kind = 'ok') => {
    const id = Math.random();
    setItems((x) => [...x, { id, msg, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.kind === 'bad' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}{t.msg}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

export function Empty({ icon: I = Inbox, title, children, action }) {
  return <div className="empty"><div className="eicon"><I size={28} /></div><h3>{title}</h3>{children && <p className="small" style={{ maxWidth: 420, margin: '0 auto' }}>{children}</p>}{action && <div className="mt-16">{action}</div>}</div>;
}
export const Spinner = () => <div className="spinner" />;

export function Stat({ icon: I, label, value, color }) {
  return (
    <div className="card stat" style={color ? { '--c1': color } : undefined}>
      <div className="si"><I size={22} /></div>
      <div><b>{value}</b><span>{label}</span></div>
    </div>
  );
}

export function useAsync(fn, deps = []) {
  const [state, set] = useState({ data: null, error: null, loading: true });
  const load = useCallback(() => {
    set((s) => ({ ...s, loading: true }));
    return fn().then((data) => set({ data, error: null, loading: false })).catch((error) => set({ data: null, error, loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load, setData: (d) => set((s) => ({ ...s, data: typeof d === 'function' ? d(s.data) : d })) };
}

export function Stepper({ stages, current, rejected }) {
  return (
    <div className="stepper">
      {stages.map((s, i) => {
        const cls = rejected && i === current ? 'bad' : i < current ? 'done' : i === current ? 'cur' : '';
        return <div key={i} className={`st ${cls}`}><i>{cls === 'done' ? '✓' : cls === 'bad' ? '✕' : i + 1}</i><small>{s}</small></div>;
      })}
    </div>
  );
}
