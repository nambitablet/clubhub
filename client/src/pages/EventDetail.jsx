import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Users, Timer, HandHeart, CalendarPlus, Settings2, ChevronRight, Ticket, AlertTriangle, Lock, Share2 } from 'lucide-react';
import { api, qrUrl } from '../api.js';
import { BRANCHES, ClubLogo, clubVars, Empty, fmtDate, fmtDT, fmtRange, fmtTime, Modal, REG_STATE, relTime, Spinner, useAsync, useToast } from '../ui.jsx';
import { ApprovalBadge, SeatBar } from './parts.jsx';
import { useAuth } from '../App.jsx';

export default function EventDetail() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { data: e, loading, error, reload } = useAsync(() => api(`/events/${id}`), [id, user?.id]);
  const [reg, setReg] = useState(false);
  if (loading && !e) return <Spinner />;
  if (error) return <div className="container page"><Empty title="Event not found">{error.message}</Empty></div>;
  const [stateLabel, tone] = REG_STATE[e.reg_state];
  const my = e.my_registration;
  const needLogin = () => nav(`/login?next=/events/${e.id}`);
  const canRegister = ['open', 'waitlist'].includes(e.reg_state) && (!e.members_only || e.is_member);
  const act = async (fn, msg) => { try { await fn(); toast(msg); reload(); refresh(); } catch (err) { toast(err.message, 'bad'); } };

  return (
    <div className="container page" style={clubVars(e.club)}>
      <div className="crumbs"><Link to="/events">Events</Link><ChevronRight size={14} /><Link to={`/clubs/${e.club.slug}`}>{e.club.name}</Link></div>
      <div className="event-hero mb-24">
        <div className="row wrap" style={{ gap: 8 }}>
          <span className="badge glass">{e.category}</span>
          <span className="badge glass">{stateLabel}</span>
          {e.members_only ? <span className="badge glass"><Lock size={12} />Members only</span> : null}
        </div>
        <h1 style={{ color: '#fff' }}>{e.title}</h1>
        <div className="row wrap" style={{ gap: 20, opacity: .92 }}>
          <span className="row" style={{ gap: 7 }}><CalendarDays size={17} />{fmtDate(e.start_at, { weekday: 'long' })}</span>
          <span className="row" style={{ gap: 7 }}><Clock size={17} />{fmtRange(e.start_at, e.end_at)}</span>
          <span className="row" style={{ gap: 7 }}><MapPin size={17} />{e.venue}</span>
        </div>
        <Link to={`/clubs/${e.club.slug}`} className="row mt-24" style={{ gap: 10, display: 'inline-flex' }}>
          <ClubLogo club={e.club} size="sm" /><div><div className="xs" style={{ opacity: .75 }}>Organised by</div><b>{e.club.name}</b></div>
        </Link>
      </div>

      {e.status === 'cancelled' && <div className="notice bad mb-24"><AlertTriangle size={18} /><div><b>This event has been cancelled.</b> Registered participants have been notified.</div></div>}

      <div className="split">
        <div className="col" style={{ gap: 20 }}>
          <div className="card card-pad"><h3 className="mb-16">About this event</h3><p className="prose">{e.description}</p></div>

          <div className="card">
            <div className="card-head"><h3 className="row"><HandHeart size={18} color="var(--c1)" />Volunteer opportunities</h3><span className="xs muted">Earn a volunteer certificate</span></div>
            {e.tasks.length === 0 ? <p className="muted small" style={{ padding: 20 }}>No volunteer roles for this event yet.</p> : e.tasks.map((t) => {
              const full = t.filled >= t.needed;
              const mine = t.my_status && t.my_status !== 'cancelled';
              const closed = e.reg_state === 'ended' || e.status !== 'published';
              return (
                <div key={t.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <div className="row wrap" style={{ gap: 8 }}><b>{t.role}</b>{mine && <span className={`badge ${t.my_status === 'completed' ? 'ok' : 'brand'}`}>{{ signed_up: 'Signed up', assigned: 'Confirmed', completed: 'Completed', no_show: 'No-show' }[t.my_status]}</span>}</div>
                    <p className="small muted" style={{ marginTop: 2 }}>{t.description}</p>
                    <div className="row wrap xs ink2 mt-8" style={{ gap: 14 }}>
                      <span className="row" style={{ gap: 5 }}><Clock size={13} />{fmtTime(t.slot_start)} – {fmtTime(t.slot_end)}</span>
                      <span className="row" style={{ gap: 5 }}><Timer size={13} />{t.hours} hrs credit</span>
                      <span className="row" style={{ gap: 5 }}><Users size={13} />{t.filled}/{t.needed} filled</span>
                    </div>
                  </div>
                  {!closed && (mine
                    ? (['signed_up', 'assigned'].includes(t.my_status) && <button className="btn btn-ghost btn-sm" onClick={() => act(() => api(`/tasks/${t.id}/signup`, { method: 'DELETE' }), 'Volunteer sign-up withdrawn')}>Withdraw</button>)
                    : <button className="btn btn-soft btn-sm" disabled={full} onClick={() => (user ? act(() => api(`/tasks/${t.id}/signup`, { method: 'POST' }), `You're volunteering as ${t.role}! 🙌`) : needLogin())}>{full ? 'Filled' : 'Volunteer'}</button>)}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="col sticky" style={{ gap: 16 }}>
          <div className="card card-pad">
            {my ? (
              <>
                <div className="row between"><h3>{my.status === 'waitlisted' ? 'You are on the waitlist' : "You're going! 🎉"}</h3></div>
                {my.status === 'waitlisted'
                  ? <div className="notice warn mt-16"><Timer size={18} /><div>Position <b>#{my.position}</b> on the waitlist. We'll move you up automatically if a seat opens.</div></div>
                  : <Ticketish e={e} r={my} />}
                {e.reg_state !== 'ended' && new Date(e.start_at) > new Date() && (
                  <button className="btn btn-ghost btn-block mt-16" onClick={() => confirm('Cancel your registration?') && act(() => api(`/events/${e.id}/cancel-registration`, { method: 'POST' }), 'Registration cancelled')}>Cancel registration</button>
                )}
              </>
            ) : (
              <>
                <div className="row between"><h3>Registration</h3><span className={`badge ${tone}`}>{stateLabel}</span></div>
                {['open', 'waitlist', 'full'].includes(e.reg_state) && <div className="mt-16"><SeatBar e={e} /></div>}
                {e.reg_deadline && e.reg_state !== 'ended' && <p className="xs muted mt-16">Registration closes {relTime(e.reg_deadline)} · {fmtDT(e.reg_deadline)}</p>}
                {e.members_only && !e.is_member ? <div className="notice mt-16"><Lock size={18} /><div>This event is for {e.club.name} members only.</div></div> : null}
                <button className="btn btn-brand btn-lg btn-block mt-16" disabled={!canRegister} onClick={() => (user ? setReg(true) : needLogin())}>
                  <Ticket size={18} />{e.reg_state === 'waitlist' ? 'Join waitlist' : canRegister ? 'Register now' : stateLabel}
                </button>
                {!user && canRegister && <p className="xs muted center mt-8">You'll be asked to sign in first.</p>}
              </>
            )}
          </div>
          <div className="card card-pad">
            <div className="info-list">
              <div><div className="ii"><CalendarDays size={17} /></div><div><b>{fmtDate(e.start_at, { weekday: 'long' })}</b><span>{fmtRange(e.start_at, e.end_at)}</span></div></div>
              <div><div className="ii"><MapPin size={17} /></div><div><b>{e.venue}</b><span>RV College of Engineering, Bengaluru</span></div></div>
              <div><div className="ii"><Users size={17} /></div><div><b>{e.capacity} seats</b><span>{e.waitlist ? 'Waitlist enabled when full' : 'No waitlist'}</span></div></div>
            </div>
            <div className="row mt-16" style={{ gap: 8 }}>
              <a className="btn btn-ghost btn-sm grow" href={`/api/events/${e.id}/ics`}><CalendarPlus size={15} />Add to calendar</a>
              <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(location.href); toast('Link copied'); }} aria-label="Copy link"><Share2 size={15} /></button>
            </div>
            <div className="mt-16"><ApprovalBadge e={e} /></div>
          </div>
          {e.can_manage && <Link to={`/manage/${e.club.id}/events/${e.id}`} className="btn btn-primary"><Settings2 size={16} />Open event console</Link>}
        </aside>
      </div>
      {reg && <RegisterModal e={e} user={user} onClose={() => setReg(false)} onDone={(r) => { setReg(false); toast(r === 'waitlisted' ? 'Added to the waitlist' : 'Registered! Your ticket is ready 🎟️'); reload(); refresh(); }} />}
    </div>
  );
}

function Ticketish({ e, r }) {
  return (
    <div className="ticket mt-16">
      <div className="top"><div className="xs" style={{ opacity: .8 }}>ENTRY PASS</div><b>{r.name}</b><div className="xs" style={{ opacity: .85 }}>{r.usn} · {r.branch}</div></div>
      <div className="perf" />
      <div className="qr">
        <img src={qrUrl(`CHK:${e.id}:${r.ticket}`)} alt="Check-in QR code" />
        <div className="small">
          {r.attendance === 'present' ? <span className="badge ok">Checked in</span> : <span className="muted">Show this QR at the check-in desk</span>}
          <div className="mono bold mt-8">{r.ticket}</div>
        </div>
      </div>
    </div>
  );
}

function RegisterModal({ e, user, onClose, onDone }) {
  const [f, setF] = useState({ name: user.name || '', usn: user.usn || '', branch: user.branch || '', year: user.year || '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });
  const submit = async (ev) => {
    ev.preventDefault(); setBusy(true); setErr('');
    try { const r = await api(`/events/${e.id}/register`, { method: 'POST', body: f }); onDone(r.my_registration?.status); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <Modal title={e.reg_state === 'waitlist' ? 'Join the waitlist' : 'Register for event'} sub={`${e.title} · ${fmtDT(e.start_at)}`} onClose={onClose}
      foot={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-brand" form="regf" disabled={busy}>{busy ? 'Registering…' : 'Confirm registration'}</button></>}>
      <form id="regf" onSubmit={submit} className="form-grid">
        <label className="field full"><span>Full name</span><input className="input" required value={f.name} onChange={set('name')} /></label>
        <label className="field"><span>USN / Student ID</span><input className="input" required value={f.usn} onChange={set('usn')} placeholder="1RV24CS001" /></label>
        <label className="field"><span>Year</span><select className="select" required value={f.year} onChange={set('year')}><option value="">Select</option>{[1, 2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}</select></label>
        <label className="field full"><span>Branch</span><select className="select" required value={f.branch} onChange={set('branch')}><option value="">Select branch</option>{Object.entries(BRANCHES).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}</select></label>
        {e.reg_state === 'waitlist' && <div className="notice warn full"><Timer size={18} /><div>This event is full. You'll be added to the waitlist and promoted automatically if someone cancels.</div></div>}
        {err && <div className="error-box full">{err}</div>}
      </form>
    </Modal>
  );
}
