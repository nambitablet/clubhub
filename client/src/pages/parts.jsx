import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Users, CalendarRange, ShieldCheck } from 'lucide-react';
import { ClubLogo, clubVars, fmtTime, REG_STATE } from '../ui.jsx';

export function DateBox({ date }) {
  const d = new Date(date);
  return (
    <div className="datebox">
      <div className="m">{d.toLocaleDateString('en-IN', { month: 'short' })}</div>
      <div className="d">{d.getDate()}</div>
      <div className="w">{d.toLocaleDateString('en-IN', { weekday: 'short' })}</div>
    </div>
  );
}

export function SeatBar({ e }) {
  const pct = Math.min(100, Math.round((100 * e.registered) / Math.max(1, e.capacity)));
  const tone = pct >= 100 ? 'bad' : pct >= 80 ? 'warn' : '';
  return (
    <div className="seats">
      <div className="row between xs" style={{ marginBottom: 6 }}>
        <span className="muted">{e.registered}/{e.capacity} registered</span>
        <span className="bold" style={{ color: tone === 'bad' ? 'var(--bad)' : tone === 'warn' ? 'var(--warn)' : 'var(--ink-2)' }}>
          {e.reg_state === 'ended' ? `${e.present} attended` : e.seats_left > 0 ? `${e.seats_left} seats left` : e.waitlisted ? `${e.waitlisted} on waitlist` : 'Full'}
        </span>
      </div>
      <div className={`bar ${tone}`}><i style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

export function EventCard({ e }) {
  const [label, tone] = REG_STATE[e.reg_state] || ['', ''];
  return (
    <Link to={`/events/${e.id}`} className="card event-card hover-lift" style={clubVars(e.club)}>
      <div className="band" />
      <div className="inner">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <DateBox date={e.start_at} />
          <div className="grow">
            <div className="row" style={{ gap: 6, marginBottom: 6 }}><span className="badge club">{e.category}</span>{e.my_registration && <span className="badge dark">{e.my_registration.status === 'waitlisted' ? 'Waitlisted' : 'Registered'}</span>}</div>
            <h3 className="clamp-2" style={{ fontSize: 16.5 }}>{e.title}</h3>
          </div>
        </div>
        <div className="row xs muted" style={{ gap: 8 }}><ClubLogo club={e.club} size="xs" /><span className="bold ink2">{e.club.name}</span></div>
        <div className="ev-meta">
          <span><Clock size={15} />{fmtTime(e.start_at)}{e.end_at && new Date(e.end_at) - new Date(e.start_at) > 86400000 ? ' · multi-day' : ''}</span>
          <span className="clamp-2"><MapPin size={15} />{e.venue}</span>
        </div>
        {['open', 'waitlist', 'full'].includes(e.reg_state) ? <SeatBar e={e} /> : <div className="seats"><span className={`badge ${tone}`}>{label}</span></div>}
      </div>
    </Link>
  );
}

export function ClubCard({ c }) {
  const I = Users;
  return (
    <Link to={`/clubs/${c.slug}`} className="card club-card hover-lift" style={clubVars(c)}>
      <div className="cover">
        <div style={{ position: 'absolute', right: 12, top: 12, display: 'flex', gap: 6 }}>
          {c.my_status === 'approved' && <span className="badge glass">Member</span>}
          {c.my_status === 'pending' && <span className="badge glass">Applied</span>}
          {c.recruitment_open ? <span className="badge glass">Recruiting</span> : null}
        </div>
      </div>
      <div className="body">
        <ClubLogo club={c} />
        <h3 className="mt-16" style={{ marginTop: 12 }}>{c.name}</h3>
        <p className="small muted clamp-2" style={{ marginTop: 4, minHeight: 42 }}>{c.tagline}</p>
        <div className="mt-8"><span className="badge club">{c.category}</span></div>
        <div className="meta">
          <span><I size={14} />{c.members} members</span>
          <span><CalendarDays size={14} />{c.upcoming} upcoming</span>
          {c.founded && <span className="hide-sm"><CalendarRange size={14} />Est. {c.founded}</span>}
        </div>
      </div>
    </Link>
  );
}

export function ApprovalBadge({ e }) {
  return e.approval === 'approved'
    ? <span className="badge ok" title="Approved by the Office of Student Affairs"><ShieldCheck size={13} />College approved</span>
    : <span className="badge warn" title="Awaiting approval from the Office of Student Affairs"><ShieldCheck size={13} />Approval pending</span>;
}
