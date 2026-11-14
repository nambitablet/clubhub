import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Search, CalendarCheck, Users, HandHeart, Award, QrCode, BarChart3, ClipboardCheck, BadgeCheck, Layers } from 'lucide-react';
import { api } from '../api.js';
import { ClubLogo, clubVars, fmtDT, useAsync } from '../ui.jsx';
import { ClubCard, EventCard } from './parts.jsx';
import { useAuth } from '../App.jsx';

export default function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const stats = useAsync(() => api('/stats'), []);
  const events = useAsync(() => api('/events?when=upcoming'), []);
  const clubs = useAsync(() => api('/clubs'), []);
  const s = stats.data || {};
  const ev = events.data || [];
  const featured = (clubs.data || []).filter((c) => ['team-antariksh', 'coding-club', 'ashwa-racing', 'dhruva', 'gdg-rvce', 'astra-robotics', 'team-vyoma', 'spark'].includes(c.slug));

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <div className="eyebrow"><b>NEW</b>{s.upcoming ?? '—'} events happening across campus</div>
            <h1>Every RVCE club.<br /><em>One place to belong.</em></h1>
            <p className="lead">Discover innovative teams, register for events, crack club recruitments, volunteer — and collect verified certificates for everything you do.</p>
            <form className="hero-search" onSubmit={(e) => { e.preventDefault(); nav(`/events?q=${encodeURIComponent(q)}`); }}>
              <Search size={20} color="#94a3b8" style={{ alignSelf: 'center', marginLeft: 8 }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hackathons, workshops, rocketry…" aria-label="Search events" />
              <button className="btn btn-primary">Search</button>
            </form>
            <div className="hero-stats">
              <div><b>{s.clubs ?? '—'}</b><span>Innovative teams</span></div>
              <div><b>{s.members ?? '—'}</b><span>Active members</span></div>
              <div><b>{s.certificates ?? '—'}</b><span>Certificates issued</span></div>
              <div><b>{s.volunteer_hours ?? '—'}</b><span>Volunteer hours</span></div>
            </div>
          </div>
          <div className="hero-visual" aria-hidden>
            {ev.slice(0, 3).map((e, i) => (
              <div key={e.id} className="float-card" style={{ ...clubVars(e.club), top: [10, 150, 290][i], left: [60, 0, 90][i] }}>
                <div className="row"><ClubLogo club={e.club} size="sm" /><div className="grow"><b className="small clamp-2" style={{ display: 'block' }}>{e.title}</b><span className="xs muted">{fmtDT(e.start_at)}</span></div></div>
                <div className="bar mt-16" style={{ marginTop: 12 }}><i style={{ width: `${Math.min(100, (100 * e.registered) / e.capacity)}%` }} /></div>
                <div className="row between xs muted" style={{ marginTop: 6 }}><span>{e.club.name}</span><span>{e.seats_left} seats left</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div><div className="kicker">Happening soon</div><h2>Upcoming events</h2><p>Workshops, hackathons, launches and talks from across campus.</p></div>
            <Link to="/events" className="btn btn-ghost">All events <ArrowRight size={16} /></Link>
          </div>
          <div className="grid g-3">
            {events.loading ? [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 260 }} />) : ev.slice(0, 6).map((e) => <EventCard key={e.id} e={e} />)}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: '#fff', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div className="section-head">
            <div><div className="kicker">Innovative teams</div><h2>Find your crew</h2><p>From Formula Student cars to student satellites — {s.clubs} clubs and counting.</p></div>
            <Link to="/clubs" className="btn btn-ghost">Explore all clubs <ArrowRight size={16} /></Link>
          </div>
          <div className="grid g-4">
            {clubs.loading ? [1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 250 }} />) : featured.map((c) => <ClubCard key={c.id} c={c} />)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="center" style={{ maxWidth: 640, margin: '0 auto 36px' }}>
            <div className="kicker">Everything in one place</div>
            <h2 style={{ fontSize: 30 }}>Built for students. Loved by club leads.</h2>
            <p className="muted mt-8">No more scattered Google Forms, spreadsheets and WhatsApp groups.</p>
          </div>
          <div className="grid g-4">
            {[
              [CalendarCheck, 'One-tap registration', 'Seat counts, deadlines and automatic waitlists — with a QR ticket for check-in.'],
              [Layers, 'Recruitment pipelines', 'Apply once and track every stage: written test, task round, interview, selection.'],
              [HandHeart, 'Volunteer sign-ups', 'Pick a role and time slot. Hours are logged and certified automatically.'],
              [Award, 'Verified certificates', 'PDF certificates with a unique ID and QR that anyone can verify online.'],
              [QrCode, 'QR check-in', 'Scan tickets at the door with any phone camera — or type a USN.'],
              [Users, 'Custom club structure', 'Every club defines its own divisions, role hierarchy and permissions.'],
              [ClipboardCheck, 'Club attendance', 'Track meetings and division syncs; members see their own attendance.'],
              [BarChart3, 'Reports & CSV', 'Live dashboards and one-click exports for events, members and volunteers.'],
            ].map(([I, t, d]) => <div key={t} className="card feature"><div className="ficon"><I size={22} /></div><h3>{t}</h3><p>{d}</p></div>)}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="card" style={{ padding: 'clamp(24px, 4vw, 44px)', background: 'linear-gradient(120deg, #0b1020, #1e1b4b)', color: '#fff', border: 0, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 24, alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: 28 }}>Got a certificate to check?</h2>
              <p style={{ color: '#c3c9da', marginTop: 8 }}>Recruiters and faculty can verify any ClubHub certificate ID instantly — no login needed.</p>
            </div>
            <div className="row wrap">
              <Link to="/verify" className="btn btn-lg" style={{ background: '#fff', color: 'var(--ink)' }}><BadgeCheck size={18} />Verify certificate</Link>
              {!user && <Link to="/signup" className="btn btn-lg" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', border: '1px solid rgba(255,255,255,.2)' }}>Create free account</Link>}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
