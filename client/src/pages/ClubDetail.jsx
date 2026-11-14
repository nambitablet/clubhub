import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Mail, Globe, AtSign, Users, CalendarDays, Trophy, Layers, Settings2, CheckCircle2, Clock, XCircle, CalendarRange, UserCheck } from 'lucide-react';
import { api } from '../api.js';
import { Avatar, ClubLogo, clubVars, Empty, fmtDT, Modal, Spinner, Stepper, useAsync, useToast, yearLabel } from '../ui.jsx';
import { EventCard } from './parts.jsx';
import { useAuth } from '../App.jsx';

export default function ClubDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const { data: c, loading, error, reload } = useAsync(() => api(`/clubs/${slug}`), [slug, user?.id]);
  const [tab, setTab] = useState('about');
  const [applying, setApplying] = useState(false);
  if (loading && !c) return <Spinner />;
  if (error) return <div className="container page"><Empty title="Club not found">{error.message}</Empty></div>;

  const now = Date.now();
  const upcoming = c.events.filter((e) => new Date(e.end_at) >= now).reverse();
  const past = c.events.filter((e) => new Date(e.end_at) < now);
  const tiers = [...new Set(c.team.map((t) => t.rank))].sort((a, b) => a - b).map((r) => c.team.filter((t) => t.rank === r));
  const m = c.my_membership;
  const withdraw = async () => { await api(`/clubs/${c.id}/apply`, { method: 'DELETE' }); toast('Application withdrawn'); reload(); };

  return (
    <div style={clubVars(c)}>
      <section className="club-hero">
        <div className="container">
          <div className="crumbs"><Link to="/clubs">Clubs</Link><ChevronRight size={14} /><span>{c.category}</span></div>
          <div className="row wrap" style={{ gap: 22, alignItems: 'center' }}>
            <ClubLogo club={c} size="lg" />
            <div className="grow" style={{ minWidth: 260 }}>
              <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}><span className="badge glass">{c.category}</span>{c.founded && <span className="badge glass">Est. {c.founded}</span>}{c.recruitment_open ? <span className="badge glass">● Recruiting now</span> : <span className="badge glass">Recruitment closed</span>}</div>
              <h1 style={{ color: '#fff' }}>{c.name}</h1>
              <p style={{ fontSize: 17, marginTop: 6 }}>{c.tagline}</p>
            </div>
            <div className="row wrap">
              {c.can_manage && <Link to={`/manage/${c.id}`} className="btn" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: '1px solid rgba(255,255,255,.3)' }}><Settings2 size={16} />Manage club</Link>}
              {!m || ['rejected', 'withdrawn', 'removed'].includes(m.status)
                ? <button className="btn btn-lg" style={{ background: '#fff', color: 'var(--ink)' }} disabled={!c.recruitment_open} onClick={() => (user ? setApplying(true) : nav(`/login?next=/clubs/${c.slug}`))}>{c.recruitment_open ? 'Apply to join' : 'Recruitment closed'}</button>
                : <span className="badge glass" style={{ height: 36, padding: '0 14px', fontSize: 13.5 }}>{m.status === 'approved' ? `✓ ${m.role_name || 'Member'}` : `Applied · ${c.stages[m.stage]}`}</span>}
            </div>
          </div>
          <div className="row wrap" style={{ gap: 28, marginTop: 28 }}>
            {[[Users, c.members_count, 'Members'], [Layers, c.divisions.length, 'Divisions'], [CalendarDays, c.stats.events, 'Events hosted'], [UserCheck, c.stats.participants, 'Participants']].map(([I, v, l]) => (
              <div key={l} className="row" style={{ gap: 10 }}><I size={20} style={{ opacity: .8 }} /><div><b style={{ font: '800 20px/1 var(--head)' }}>{v}</b><div className="xs" style={{ opacity: .75 }}>{l}</div></div></div>
            ))}
          </div>
        </div>
      </section>

      <div className="container page" style={{ paddingTop: 24 }}>
        <div className="split">
          <div>
            <div className="tabs">
              {[['about', 'About'], ['divisions', 'Divisions', c.divisions.length], ['team', 'Team', c.team.length], ['events', 'Events', c.events.length]].map(([k, l, n]) => (
                <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{n != null && <span className="count">{n}</span>}</button>
              ))}
            </div>

            {tab === 'about' && (
              <div className="col" style={{ gap: 20 }}>
                <div className="card card-pad"><h3 className="mb-16">About {c.name}</h3><p className="prose">{c.description}</p></div>
                {c.milestones.length > 0 && (
                  <div className="card card-pad"><h3 className="mb-16 row"><Trophy size={18} color="var(--c1)" />Milestones</h3>
                    <div className="timeline">{c.milestones.map((x, i) => <div key={i} className="ink2">{x}</div>)}</div>
                  </div>
                )}
                <div className="card card-pad">
                  <h3>How recruitment works</h3>
                  <p className="small muted mt-8">{c.recruitment_note || 'Apply through ClubHub and track each stage here.'}</p>
                  <div className="mt-16"><Stepper stages={c.stages} current={-1} /></div>
                </div>
                {upcoming.length > 0 && <div><h3 className="mb-16">Coming up</h3><div className="grid g-2">{upcoming.slice(0, 2).map((e) => <EventCard key={e.id} e={e} />)}</div></div>}
              </div>
            )}

            {tab === 'divisions' && (
              <div className="grid g-2">
                {c.divisions.map((d, i) => (
                  <div key={d.id} className="card card-pad row" style={{ alignItems: 'flex-start' }}>
                    <div className="club-logo sm" style={{ fontWeight: 800, fontSize: 14 }}>{String(i + 1).padStart(2, '0')}</div>
                    <div className="grow"><h3 style={{ fontSize: 15.5 }}>{d.name}</h3><p className="small muted">{d.description || `${d.members} member${d.members === 1 ? '' : 's'}`}</p></div>
                  </div>
                ))}
                {!c.divisions.length && <Empty title="No divisions yet" />}
              </div>
            )}

            {tab === 'team' && (
              <div className="card card-pad">
                <h3 className="mb-24">Leadership & core team</h3>
                {tiers.length === 0 && <Empty icon={Users} title="Team not listed yet">The club's leadership will appear here once members are added on ClubHub.</Empty>}
                {tiers.map((tier, i) => (
                  <div key={i}>
                    {i > 0 && <div className="org-line" />}
                    <div className="org-tier">
                      {tier.map((p) => (
                        <div key={p.id + p.role} className="org-node">
                          <Avatar name={p.name} />
                          <div><b className="small" style={{ display: 'block' }}>{p.name}</b><span className="xs" style={{ color: 'var(--c1)', fontWeight: 600 }}>{p.role}</span><span className="xs muted" style={{ display: 'block' }}>{p.division || `${p.branch} · ${yearLabel(p.year)}`}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'events' && (
              <div className="col" style={{ gap: 24 }}>
                <div><h3 className="mb-16">Upcoming</h3>{upcoming.length ? <div className="grid g-2">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</div> : <p className="muted small">No upcoming events right now.</p>}</div>
                <div><h3 className="mb-16">Past events</h3>{past.length ? <div className="grid g-2">{past.map((e) => <EventCard key={e.id} e={e} />)}</div> : <p className="muted small">No past events yet.</p>}</div>
              </div>
            )}
          </div>

          <aside className="col sticky" style={{ gap: 16 }}>
            {m && !['withdrawn', 'removed'].includes(m.status) && (
              <div className="card card-pad">
                <div className="row between"><h3>Your membership</h3>
                  {m.status === 'approved' ? <span className="badge ok"><CheckCircle2 size={13} />Member</span> : m.status === 'rejected' ? <span className="badge bad"><XCircle size={13} />Not selected</span> : <span className="badge warn"><Clock size={13} />In progress</span>}
                </div>
                {m.status === 'approved' ? (
                  <p className="small ink2 mt-8">You are <b>{m.role_name}</b>{m.division_name && <> in <b>{m.division_name}</b></>}.</p>
                ) : (
                  <>
                    <Stepper stages={c.stages} current={m.stage} rejected={m.status === 'rejected'} />
                    {m.stage_date && m.status === 'pending' && <div className="notice mt-16"><CalendarRange size={18} /><div><b>{c.stages[m.stage]}</b><br />{fmtDT(m.stage_date)}</div></div>}
                    {m.note && <p className="small ink2 mt-16">{m.note}</p>}
                    {m.status === 'pending' && <button className="btn btn-ghost btn-sm mt-16" onClick={withdraw}>Withdraw application</button>}
                  </>
                )}
              </div>
            )}
            <div className="card card-pad">
              <h3 className="mb-16">Contact</h3>
              <div className="col small" style={{ gap: 10 }}>
                {c.email && <a className="row ink2" href={`mailto:${c.email}`}><Mail size={16} />{c.email}</a>}
                {c.instagram && <span className="row ink2"><AtSign size={16} />{c.instagram}</span>}
                {c.website && <a className="row ink2" href={c.website} target="_blank" rel="noreferrer"><Globe size={16} />RVCE team page ↗</a>}
              </div>
              <p className="xs muted mt-16">Contact details are placeholders for the prototype.</p>
            </div>
            <div className="card card-pad">
              <h3 className="mb-16">Roles in this club</h3>
              <div className="row wrap" style={{ gap: 6 }}>{c.roles.map((r) => <span key={r.id} className="badge club">{r.name}</span>)}</div>
            </div>
          </aside>
        </div>
      </div>
      {applying && <ApplyModal club={c} onClose={() => setApplying(false)} onDone={() => { setApplying(false); toast(`Application sent to ${c.name}!`); reload(); }} />}
    </div>
  );
}

function ApplyModal({ club, onClose, onDone }) {
  const [division, setDivision] = useState('');
  const [statement, setStatement] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr('');
    try { await api(`/clubs/${club.id}/apply`, { method: 'POST', body: { division_id: division || null, statement } }); onDone(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title={`Apply to ${club.name}`} sub="Your application goes straight to the club's recruitment team." onClose={onClose}
      foot={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-brand" disabled={busy} onClick={submit}>{busy ? 'Sending…' : 'Submit application'}</button></>}>
      <div className="col" style={{ gap: 16 }}>
        <div className="notice"><Layers size={18} /><div>Selection process: <b>{club.stages.join(' → ')}</b>. You'll get a notification at every stage.</div></div>
        <label className="field"><span>Preferred division</span>
          <select className="select" value={division} onChange={(e) => setDivision(e.target.value)}><option value="">No preference</option>{club.divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        </label>
        <label className="field"><span>Why do you want to join?</span><textarea className="textarea" value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Tell them about your interests, skills or projects…" /></label>
        {err && <div className="error-box">{err}</div>}
      </div>
    </Modal>
  );
}
