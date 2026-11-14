import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, Users, HandHeart, Award, Timer, Download, ExternalLink, CalendarRange, CheckCircle2, XCircle, Clock, Compass, Ticket, MapPin } from 'lucide-react';
import { api, fileUrl, qrUrl } from '../api.js';
import { Avatar, BRANCHES, ClubLogo, clubVars, Empty, fmtDate, fmtDT, fmtTime, Modal, Spinner, Stat, Stepper, useAsync, useToast, yearLabel } from '../ui.jsx';
import { useAuth } from '../App.jsx';
import { DateBox } from './parts.jsx';

export default function MySpace() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || 'events';
  const { data, loading, reload } = useAsync(() => api('/me/dashboard'), []);
  if (loading && !data) return <Spinner />;
  const s = data.stats;
  const tabs = [['events', 'My events', data.registrations.length], ['clubs', 'Clubs & applications', data.memberships.length], ['volunteering', 'Volunteering', data.volunteering.length], ['certificates', 'Certificates', data.certificates.length], ['profile', 'Profile']];
  return (
    <div className="container page">
      <div className="row wrap mb-24" style={{ gap: 18 }}>
        <Avatar name={user.name} size="lg" />
        <div className="grow"><h1 style={{ fontSize: 30 }}>Hi, {user.name.split(' ')[0]} 👋</h1><p className="muted">{[user.usn, BRANCHES[user.branch], yearLabel(user.year)].filter(Boolean).join(' · ') || user.email}</p></div>
        <Link to="/events" className="btn btn-primary"><Compass size={16} />Find events</Link>
      </div>
      <div className="grid g-4 mb-24">
        <Stat icon={CalendarDays} label="Upcoming events" value={s.upcoming} color="#4f46e5" />
        <Stat icon={Users} label="Clubs joined" value={s.clubs} color="#0891b2" />
        <Stat icon={Timer} label="Volunteer hours" value={s.hours} color="#db2777" />
        <Stat icon={Award} label="Certificates" value={s.certificates} color="#d97706" />
      </div>
      <div className="tabs">{tabs.map(([k, l, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setSp({ tab: k }, { replace: true })}>{l}{n != null && <span className="count">{n}</span>}</button>)}</div>
      {tab === 'events' && <MyEvents regs={data.registrations} />}
      {tab === 'clubs' && <MyClubs list={data.memberships} reload={reload} />}
      {tab === 'volunteering' && <MyVolunteering list={data.volunteering} />}
      {tab === 'certificates' && <MyCerts list={data.certificates} />}
      {tab === 'profile' && <Profile />}
    </div>
  );
}

function MyEvents({ regs }) {
  const [ticket, setTicket] = useState(null);
  const now = Date.now();
  const up = regs.filter((r) => new Date(r.event.end_at) >= now);
  const past = regs.filter((r) => new Date(r.event.end_at) < now).reverse();
  if (!regs.length) return <Empty icon={CalendarDays} title="No registrations yet" action={<Link className="btn btn-primary" to="/events">Browse events</Link>}>Register for an event and your QR ticket will show up here.</Empty>;
  const Row = ({ r }) => (
    <div className="list-row" style={clubVars(r.event.club)}>
      <DateBox date={r.event.start_at} />
      <div className="grow">
        <Link to={`/events/${r.event.id}`} className="bold">{r.event.title}</Link>
        <div className="row wrap xs muted" style={{ gap: 12, marginTop: 2 }}><span className="row" style={{ gap: 5 }}><ClubLogo club={r.event.club} size="xs" />{r.event.club.name}</span><span className="row" style={{ gap: 4 }}><Clock size={12} />{fmtTime(r.event.start_at)}</span><span className="row" style={{ gap: 4 }}><MapPin size={12} />{r.event.venue}</span></div>
      </div>
      {r.event.status === 'cancelled' ? <span className="badge bad">Cancelled</span>
        : r.attendance === 'present' ? <span className="badge ok"><CheckCircle2 size={13} />Attended</span>
          : r.attendance === 'absent' ? <span className="badge bad">Absent</span>
            : r.status === 'waitlisted' ? <span className="badge warn">Waitlist #{r.event.my_registration?.position}</span>
              : new Date(r.event.end_at) >= now ? <button className="btn btn-soft btn-sm" onClick={() => setTicket(r)}><Ticket size={15} />Ticket</button> : <span className="badge">Not marked</span>}
    </div>
  );
  return (
    <div className="col" style={{ gap: 24 }}>
      <div className="card"><div className="card-head"><h3>Upcoming</h3><span className="badge">{up.length}</span></div>{up.length ? up.map((r) => <Row key={r.id} r={r} />) : <p className="muted small" style={{ padding: 20 }}>Nothing coming up — <Link className="link" to="/events">find something fun</Link>.</p>}</div>
      <div className="card"><div className="card-head"><h3>Past events</h3><span className="badge">{past.length}</span></div>{past.length ? past.map((r) => <Row key={r.id} r={r} />) : <p className="muted small" style={{ padding: 20 }}>No past events yet.</p>}</div>
      {ticket && (
        <Modal title="Your entry pass" sub={ticket.event.title} onClose={() => setTicket(null)}>
          <div className="center" style={clubVars(ticket.event.club)}>
            <img src={qrUrl(`CHK:${ticket.event.id}:${ticket.ticket}`)} alt="Ticket QR" style={{ width: 240, height: 240, border: '1px solid var(--line)', borderRadius: 16, padding: 8 }} />
            <div className="mono bold mt-16" style={{ fontSize: 20 }}>{ticket.ticket}</div>
            <p className="muted small mt-8">{ticket.name} · {ticket.usn}<br />{fmtDT(ticket.event.start_at)} · {ticket.event.venue}</p>
            <p className="xs muted mt-16">Show this QR at the check-in desk. Organisers can also check you in with your USN.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MyClubs({ list, reload }) {
  const toast = useToast();
  if (!list.length) return <Empty icon={Users} title="You haven't joined any clubs yet" action={<Link className="btn btn-primary" to="/clubs">Explore clubs</Link>}>Apply to a club and follow every recruitment stage here.</Empty>;
  return (
    <div className="grid g-2">
      {list.map((m) => {
        const pct = m.attendance.total ? Math.round((100 * m.attendance.present) / m.attendance.total) : null;
        return (
          <div key={m.id} className="card card-pad" style={clubVars(m)}>
            <div className="row">
              <ClubLogo club={m} />
              <div className="grow"><Link to={`/clubs/${m.slug}`} className="bold">{m.club_name}</Link><div className="xs muted">{m.status === 'approved' ? `${m.role_name}${m.division_name ? ' · ' + m.division_name : ''}` : `Applied ${fmtDate(m.applied_at)}${m.division_name ? ' · ' + m.division_name : ''}`}</div></div>
              {m.status === 'approved' ? <span className="badge ok"><CheckCircle2 size={13} />Member</span> : m.status === 'rejected' ? <span className="badge bad"><XCircle size={13} />Not selected</span> : <span className="badge warn"><Clock size={13} />{m.stages[m.stage]}</span>}
            </div>
            {m.status === 'approved' ? (
              <div className="mt-16">
                <div className="row between small"><b>Club attendance</b><span className="muted">{m.attendance.total ? `${m.attendance.present}/${m.attendance.total} meetings · ${pct}%` : 'No meetings recorded yet'}</span></div>
                {m.attendance.total > 0 && <div className={`bar mt-8 ${pct < 60 ? 'bad' : pct < 75 ? 'warn' : 'ok'}`}><i style={{ width: `${pct}%` }} /></div>}
                <div className="row wrap mt-16" style={{ gap: 6 }}>
                  {m.attendance.meetings.map((x, i) => <span key={i} title={`${x.title} · ${fmtDate(x.date)}`} className={`badge ${x.status === 'present' ? 'ok' : 'bad'}`}>{fmtDate(x.date, { year: undefined })}</span>)}
                </div>
              </div>
            ) : (
              <>
                <Stepper stages={m.stages} current={m.stage} rejected={m.status === 'rejected'} />
                {m.stage_date && m.status === 'pending' && <div className="notice mt-16"><CalendarRange size={18} /><div><b>{m.stages[m.stage]}</b> · {fmtDT(m.stage_date)}{m.note && <div className="small mt-8" style={{ marginTop: 4 }}>{m.note}</div>}</div></div>}
                {!m.stage_date && m.note && <p className="small ink2 mt-16">{m.note}</p>}
                {m.status === 'pending' && m.stage === 0 && <p className="xs muted mt-16">Your application is with the recruitment team. You'll be notified when they schedule the next round.</p>}
                {m.status === 'pending' && <button className="btn btn-ghost btn-sm mt-16" onClick={async () => { await api(`/clubs/${m.club_id}/apply`, { method: 'DELETE' }); toast('Application withdrawn'); reload(); }}>Withdraw</button>}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MyVolunteering({ list }) {
  if (!list.length) return <Empty icon={HandHeart} title="No volunteering yet" action={<Link className="btn btn-primary" to="/events">Find volunteer roles</Link>}>Open any event and pick a volunteer role to earn hours and a certificate.</Empty>;
  const label = { signed_up: ['Signed up', 'brand'], assigned: ['Confirmed', 'info'], completed: ['Completed', 'ok'], no_show: ['No-show', 'bad'] };
  return (
    <div className="card">
      <div className="table-wrap"><table className="table">
        <thead><tr><th>Role</th><th>Event</th><th>Slot</th><th>Status</th><th style={{ textAlign: 'right' }}>Hours</th></tr></thead>
        <tbody>{list.map((v) => (
          <tr key={v.id} style={clubVars(v)}>
            <td><b>{v.role}</b><div className="xs muted">{v.description}</div></td>
            <td><Link to={`/events/${v.event_id}`} className="row" style={{ gap: 8 }}><ClubLogo club={v} size="xs" /><span>{v.event_title}</span></Link></td>
            <td className="nowrap small">{fmtDate(v.slot_start)}<div className="xs muted">{fmtTime(v.slot_start)} – {fmtTime(v.slot_end)}</div></td>
            <td><span className={`badge ${label[v.status]?.[1]}`}>{label[v.status]?.[0]}</span></td>
            <td style={{ textAlign: 'right' }} className="bold">{v.status === 'completed' ? v.hours : <span className="muted">{v.task_hours} planned</span>}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </div>
  );
}

function MyCerts({ list }) {
  if (!list.length) return <Empty icon={Award} title="No certificates yet">Attend events or volunteer — certificates appear here once organisers issue them.</Empty>;
  return (
    <div className="grid g-3">
      {list.map((c) => (
        <div key={c.code} className="cert-card" style={clubVars(c)}>
          <div className="row"><ClubLogo club={c} size="sm" /><span className={`badge ${c.type === 'volunteer' ? 'club' : 'warn'}`}>{c.type === 'volunteer' ? 'Volunteer' : 'Participation'}</span></div>
          <h3 className="mt-16 clamp-2" style={{ fontSize: 16 }}>{c.event_title}</h3>
          <p className="xs muted">{c.club_name} · {fmtDate(c.start_at)}{c.type === 'volunteer' && c.hours ? ` · ${c.hours} hrs` : ''}</p>
          <div className="mono xs mt-16" style={{ color: 'var(--ink-2)' }}>ID: {c.code}</div>
          <div className="row mt-16" style={{ gap: 8 }}>
            <a className="btn btn-primary btn-sm grow" href={fileUrl(`/certificates/${c.code}/pdf`)}><Download size={15} />Download PDF</a>
            <a className="btn btn-ghost btn-sm" href={fileUrl(`/certificates/${c.code}/pdf`, '&inline=1')} target="_blank" rel="noreferrer" aria-label="Preview"><ExternalLink size={15} /></a>
            <Link className="btn btn-ghost btn-sm" to={`/verify/${c.code}`}>Verify</Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ name: user.name, usn: user.usn || '', branch: user.branch || '', year: user.year || '', phone: user.phone || '', bio: user.bio || '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async (e) => { e.preventDefault(); setErr(''); try { await api('/me', { method: 'PUT', body: f }); await refresh(); setF({ ...f, password: '' }); toast('Profile saved'); } catch (x) { setErr(x.message); } };
  return (
    <form className="card card-pad" style={{ maxWidth: 720 }} onSubmit={save}>
      <h3 className="mb-16">Profile</h3>
      <div className="form-grid">
        <label className="field"><span>Full name</span><input className="input" value={f.name} onChange={set('name')} required /></label>
        <label className="field"><span>Email</span><input className="input" value={user.email} disabled /></label>
        <label className="field"><span>USN</span><input className="input" value={f.usn} onChange={set('usn')} /></label>
        <label className="field"><span>Phone</span><input className="input" value={f.phone} onChange={set('phone')} /></label>
        <label className="field"><span>Branch</span><select className="select" value={f.branch} onChange={set('branch')}><option value="">—</option>{Object.entries(BRANCHES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>Year</span><select className="select" value={f.year} onChange={set('year')}><option value="">—</option>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></label>
        <label className="field full"><span>Bio</span><textarea className="textarea" value={f.bio} onChange={set('bio')} placeholder="A line about you and your interests" /></label>
        <label className="field full"><span>New password</span><input className="input" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} placeholder="Leave blank to keep current password" /></label>
        {err && <div className="error-box full">{err}</div>}
      </div>
      <div className="row mt-24"><button className="btn btn-primary">Save changes</button></div>
    </form>
  );
}
