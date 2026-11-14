import { useSearchParams } from 'react-router-dom';
import { Search, CalendarX2, X } from 'lucide-react';
import { api } from '../api.js';
import { Empty, useAsync } from '../ui.jsx';
import { EventCard } from './parts.jsx';

export default function Events() {
  const [sp, setSp] = useSearchParams();
  const get = (k, d = '') => sp.get(k) || d;
  const when = get('when', 'upcoming');
  const f = { q: get('q'), club: get('club'), category: get('category'), from: get('from'), to: get('to') };
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };
  const clubs = useAsync(() => api('/clubs'), []);
  const cats = useAsync(() => api('/categories'), []);
  const qs = new URLSearchParams({ when, ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)) }).toString();
  const events = useAsync(() => api(`/events?${qs}`), [qs]);
  const active = Object.values(f).some(Boolean);

  // group by month
  const groups = [];
  (events.data || []).forEach((e) => {
    const k = new Date(e.start_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const g = groups.find((x) => x.k === k); g ? g.items.push(e) : groups.push({ k, items: [e] });
  });

  return (
    <div className="container page">
      <div className="page-head row between wrap" style={{ alignItems: 'end' }}>
        <div><div className="kicker">What's on at RVCE</div><h1>Events</h1><p>Search, filter and register in a couple of taps.</p></div>
        <div className="seg">{['upcoming', 'past', 'all'].map((w) => <button key={w} className={when === w ? 'on' : ''} onClick={() => set('when', w === 'upcoming' ? '' : w)}>{w[0].toUpperCase() + w.slice(1)}</button>)}</div>
      </div>
      <div className="card card-pad mb-24" style={{ padding: 14 }}>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="input-icon grow" style={{ minWidth: 220 }}><Search size={18} /><input className="input" placeholder="Keyword, venue or club…" value={f.q} onChange={(e) => set('q', e.target.value)} /></div>
          <select className="select" style={{ width: 200 }} value={f.club} onChange={(e) => set('club', e.target.value)} aria-label="Club">
            <option value="">All clubs</option>{(clubs.data || []).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          <select className="select" style={{ width: 170 }} value={f.category} onChange={(e) => set('category', e.target.value)} aria-label="Category">
            <option value="">All categories</option>{(cats.data?.events || []).map((c) => <option key={c.category}>{c.category}</option>)}
          </select>
          <input type="date" className="input" style={{ width: 160 }} value={f.from} onChange={(e) => set('from', e.target.value)} aria-label="From date" title="From date" />
          <input type="date" className="input" style={{ width: 160 }} value={f.to} onChange={(e) => set('to', e.target.value)} aria-label="To date" title="To date" />
          {active && <button className="btn btn-ghost" onClick={() => setSp(when !== 'upcoming' ? { when } : {}, { replace: true })}><X size={16} />Clear</button>}
        </div>
      </div>
      {events.loading && !events.data ? <div className="grid g-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 260 }} />)}</div>
        : groups.length === 0 ? <Empty icon={CalendarX2} title="No events found">Try clearing filters or switching to {when === 'past' ? 'upcoming' : 'past'} events.</Empty>
          : groups.map((g) => (
            <div key={g.k} className="mb-24" style={{ marginBottom: 36 }}>
              <h3 className="mb-16 row" style={{ gap: 10 }}>{g.k}<span className="badge">{g.items.length}</span></h3>
              <div className="grid g-3">{g.items.map((e) => <EventCard key={e.id} e={e} />)}</div>
            </div>
          ))}
    </div>
  );
}
