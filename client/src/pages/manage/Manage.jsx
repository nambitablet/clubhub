import { Link, Navigate, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarDays, ClipboardCheck, Settings2, ExternalLink, UserPlus, CalendarCheck, Timer, Award, Download, ArrowRight, TrendingUp, FileSpreadsheet } from 'lucide-react';
import { api, fileUrl } from '../../api.js';
import { ClubLogo, clubVars, Empty, fmtDate, REG_STATE, Spinner, Stat, useAsync } from '../../ui.jsx';
import { useAuth } from '../../App.jsx';
import Members from './Members.jsx';
import EventsAdmin from './EventsAdmin.jsx';
import EventConsole from './EventConsole.jsx';
import Meetings from './Meetings.jsx';
import Settings from './Settings.jsx';

export default function Manage() {
  const { managed } = useAuth();
  if (!managed?.length) return <div className="container page"><Empty icon={Settings2} title="You don't manage any clubs yet">Club leaders with admin roles (e.g. President, Secretary) can manage their club here. Ask your club president to give your role permissions.</Empty></div>;
  return (
    <Routes>
      <Route index element={<Navigate to={`/manage/${managed[0].id}`} replace />} />
      <Route path=":clubId/*" element={<Console />} />
    </Routes>
  );
}

function Console() {
  const { clubId } = useParams();
  const { managed } = useAuth();
  const nav = useNavigate();
  const club = managed.find((c) => String(c.id) === clubId);
  if (!club) return <Navigate to="/manage" replace />;
  const base = `/manage/${club.id}`;
  return (
    <div className="console" style={clubVars(club)}>
      <aside className="side">
        <div className="club-switch">
          <ClubLogo club={club} size="sm" />
          <div className="grow">
            {managed.length > 1 ? (
              <select className="select" style={{ height: 30, border: 0, padding: 0, background: 'transparent', fontWeight: 700 }} value={club.id} onChange={(e) => nav(`/manage/${e.target.value}`)} aria-label="Switch club">
                {managed.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : <b className="small">{club.name}</b>}
            <div className="xs muted">{club.role_name || 'College administrator'}</div>
          </div>
        </div>
        <nav>
          <div className="label">Club</div>
          <NavLink end to={base}><LayoutDashboard size={17} />Dashboard</NavLink>
          <NavLink to={`${base}/members`}><Users size={17} />Members & recruitment</NavLink>
          <NavLink to={`${base}/events`}><CalendarDays size={17} />Events</NavLink>
          <NavLink to={`${base}/meetings`}><ClipboardCheck size={17} />Club attendance</NavLink>
          <NavLink to={`${base}/settings`}><Settings2 size={17} />Profile & structure</NavLink>
          <div className="label">Public</div>
          <Link to={`/clubs/${club.slug}`}><ExternalLink size={17} />View club page</Link>
        </nav>
      </aside>
      <main className="console-main">
        <Routes>
          <Route index element={<Overview clubId={club.id} />} />
          <Route path="members" element={<Members clubId={club.id} />} />
          <Route path="events" element={<EventsAdmin clubId={club.id} />} />
          <Route path="events/:eventId" element={<EventConsole clubId={club.id} />} />
          <Route path="meetings" element={<Meetings clubId={club.id} />} />
          <Route path="settings" element={<Settings clubId={club.id} />} />
        </Routes>
      </main>
    </div>
  );
}

export function ConsoleHead({ title, sub, children }) {
  return (
    <div className="row between wrap mb-24" style={{ alignItems: 'end' }}>
      <div><h1 style={{ fontSize: 28 }}>{title}</h1>{sub && <p className="muted mt-8" style={{ marginTop: 4 }}>{sub}</p>}</div>
      <div className="row wrap">{children}</div>
    </div>
  );
}

function Overview({ clubId }) {
  const { data, loading } = useAsync(() => api(`/manage/${clubId}/overview`), [clubId]);
  if (loading || !data) return <Spinner />;
  const { club, totals: t, events, byDivision, byYear, pipeline, topVolunteers } = data;
  const now = new Date().toISOString();
  const upcoming = events.filter((e) => e.end_at > now && e.status !== 'cancelled').reverse();
  const recent = events.filter((e) => e.end_at <= now && e.status === 'published').slice(0, 8).reverse();
  const maxDiv = Math.max(1, ...byDivision.map((d) => d.n));
  const maxReg = Math.max(1, ...recent.map((e) => e.registered));
  const attRate = t.marked ? Math.round((100 * t.attended) / t.marked) : 0;
  return (
    <>
      <ConsoleHead title={`${club.name} dashboard`} sub="Live overview of members, events, attendance and volunteers.">
        <a className="btn btn-ghost btn-sm" href={fileUrl(`/manage/${clubId}/report/events.csv`)}><FileSpreadsheet size={15} />Events report</a>
        <a className="btn btn-ghost btn-sm" href={fileUrl(`/manage/${clubId}/report/members.csv`)}><Download size={15} />Members</a>
        <a className="btn btn-ghost btn-sm" href={fileUrl(`/manage/${clubId}/report/volunteers.csv`)}><Download size={15} />Volunteers</a>
      </ConsoleHead>
      <div className="grid g-4 mb-24">
        <Stat icon={Users} label="Active members" value={t.members} />
        <Stat icon={UserPlus} label="Open applications" value={t.applications} color="#d97706" />
        <Stat icon={CalendarCheck} label="Upcoming events" value={t.upcoming} color="#0891b2" />
        <Stat icon={Award} label="Certificates issued" value={t.certificates} color="#059669" />
      </div>
      <div className="grid g-3 mb-24">
        <div className="card card-pad">
          <div className="row between"><h3>Attendance rate</h3><TrendingUp size={18} className="muted" /></div>
          <div className="row mt-16" style={{ gap: 20 }}>
            <div className="ring" style={{ '--p': attRate }}><div><b>{attRate}%</b><span className="xs muted">present</span></div></div>
            <div className="col small" style={{ gap: 6 }}><span><b>{t.registrations}</b> <span className="muted">registrations</span></span><span><b>{t.attended}</b> <span className="muted">attended</span></span><span><b>{t.marked - t.attended}</b> <span className="muted">absent</span></span></div>
          </div>
        </div>
        <div className="card card-pad">
          <div className="row between"><h3>Volunteers</h3><Timer size={18} className="muted" /></div>
          <div className="row mt-16" style={{ gap: 24 }}><div><b style={{ font: '800 30px/1 var(--head)' }}>{Math.round(t.volunteer_hours)}</b><div className="xs muted">hours logged</div></div><div><b style={{ font: '800 30px/1 var(--head)' }}>{t.volunteers}</b><div className="xs muted">volunteers</div></div></div>
          <div className="col mt-16" style={{ gap: 6 }}>{topVolunteers.slice(0, 3).map((v) => <div key={v.name} className="row between small"><span>{v.name}</span><span className="muted">{v.hours} h</span></div>)}</div>
        </div>
        <div className="card card-pad">
          <div className="row between"><h3>Recruitment pipeline</h3><Link to={`/manage/${clubId}/members`} className="link small">Review</Link></div>
          <div className="hbars mt-16">{pipeline.slice(0, -1).map((p) => <div key={p.stage} className="hbar" style={{ gridTemplateColumns: '1fr 70px 24px' }}><span className="small">{p.stage}</span><div className="bar"><i style={{ width: `${Math.min(100, p.n * 20)}%` }} /></div><em>{p.n}</em></div>)}</div>
        </div>
      </div>
      <div className="grid g-2 mb-24">
        <div className="card card-pad">
          <div className="row between mb-16"><h3>Registrations vs attendance</h3><div className="legend"><span><i style={{ background: 'var(--c1)' }} />Attended</span><span><i style={{ background: 'color-mix(in srgb, var(--c1) 25%, white)' }} />Registered</span></div></div>
          {recent.length ? (
            <div className="vchart">
              {recent.map((e) => (
                <div key={e.id} className="vb" title={`${e.title}: ${e.present}/${e.registered}`}>
                  <span className="xs bold">{e.present}</span>
                  <div className="stack" style={{ height: `${(140 * e.registered) / maxReg}px`, background: 'color-mix(in srgb, var(--c1) 25%, white)' }}><i style={{ height: `${(100 * e.present) / Math.max(1, e.registered)}%`, background: 'linear-gradient(var(--c2), var(--c1))' }} /></div>
                  <small>{e.title.split(/[:\s]/)[0]}</small>
                </div>
              ))}
            </div>
          ) : <p className="muted small">No past events yet.</p>}
        </div>
        <div className="card card-pad">
          <h3 className="mb-16">Members by division</h3>
          <div className="hbars">{byDivision.map((d) => <div key={d.name} className="hbar"><span className="small clamp-2">{d.name}</span><div className="bar"><i style={{ width: `${(100 * d.n) / maxDiv}%` }} /></div><em>{d.n}</em></div>)}</div>
          <div className="row wrap mt-24" style={{ gap: 8 }}>{byYear.filter((y) => y.year).map((y) => <span key={y.year} className="badge club">Year {y.year}: {y.n}</span>)}</div>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><h3>Upcoming events</h3><Link to={`/manage/${clubId}/events`} className="btn btn-ghost btn-sm">Manage events <ArrowRight size={14} /></Link></div>
        {upcoming.length ? upcoming.map((e) => (
          <Link key={e.id} to={`/manage/${clubId}/events/${e.id}`} className="list-row">
            <div className="grow"><b>{e.title}</b><div className="xs muted">{fmtDate(e.start_at, { weekday: 'short' })} · {e.venue}</div></div>
            <span className={`badge ${REG_STATE[e.reg_state][1]}`}>{REG_STATE[e.reg_state][0]}</span>
            <span className="small nowrap hide-sm"><b>{e.registered}</b>/{e.capacity}</span>
          </Link>
        )) : <p className="muted small" style={{ padding: 20 }}>No upcoming events. <Link to={`/manage/${clubId}/events`} className="link">Create one</Link></p>}
      </div>
    </>
  );
}
