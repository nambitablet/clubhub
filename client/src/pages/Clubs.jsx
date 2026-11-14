import { useSearchParams } from 'react-router-dom';
import { Search, SearchX } from 'lucide-react';
import { api } from '../api.js';
import { Empty, useAsync } from '../ui.jsx';
import { ClubCard } from './parts.jsx';

export default function Clubs() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') || ''; const category = sp.get('category') || '';
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }); };
  const cats = useAsync(() => api('/categories'), []);
  const clubs = useAsync(() => api(`/clubs?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`), [q, category]);
  return (
    <div className="container page">
      <div className="page-head row between wrap" style={{ alignItems: 'end' }}>
        <div><div className="kicker">Innovative teams of RVCE</div><h1>Explore clubs</h1><p>Find teams that match your passion — and see who is recruiting right now.</p></div>
        <div className="input-icon" style={{ width: 320, maxWidth: '100%' }}><Search size={18} /><input className="input" placeholder="Search clubs…" value={q} onChange={(e) => set('q', e.target.value)} /></div>
      </div>
      <div className="chips mb-24">
        <button className={`chip ${!category ? 'on' : ''}`} onClick={() => set('category', '')}>All</button>
        {(cats.data?.clubs || []).map((c) => <button key={c.category} className={`chip ${category === c.category ? 'on' : ''}`} onClick={() => set('category', c.category)}>{c.category} <span style={{ opacity: .6 }}>{c.n}</span></button>)}
      </div>
      {clubs.loading && !clubs.data ? <div className="grid g-4">{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="skeleton" style={{ height: 250 }} />)}</div>
        : clubs.data?.length ? <div className="grid g-4">{clubs.data.map((c) => <ClubCard key={c.id} c={c} />)}</div>
          : <Empty icon={SearchX} title="No clubs match">Try a different keyword or category.</Empty>}
    </div>
  );
}
