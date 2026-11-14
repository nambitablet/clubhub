import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Send, Ban, ExternalLink, Download, Search, Check, X, QrCode, Camera, CameraOff, UserCheck, Plus, Trash2, Award, CheckCircle2, AlertCircle, HandHeart, Users, ClipboardList, Undo2 } from 'lucide-react';
import { api, fileUrl } from '../../api.js';
import { Avatar, Empty, fmtDT, fmtTime, Modal, REG_STATE, relTime, Spinner, Stat, toLocalInput, useAsync, useToast } from '../../ui.jsx';
import { ApprovalBadge } from '../parts.jsx';
import { EventForm } from './EventsAdmin.jsx';

export default function EventConsole({ clubId }) {
  const { eventId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data: e, loading, reload, setData } = useAsync(() => api(`/manage/events/${eventId}`), [eventId]);
  const [tab, setTab] = useState('attendance');
  const [editing, setEditing] = useState(false);
  if (loading && !e) return <Spinner />;
  const status = async (s) => {
    if (s === 'cancelled' && !confirm('Cancel this event? All registered participants will be notified.')) return;
    try { await api(`/manage/events/${e.id}/status`, { method: 'POST', body: { status: s } }); toast({ published: 'Event published', draft: 'Moved to drafts', cancelled: 'Event cancelled' }[s]); reload(); } catch (x) { toast(x.message, 'bad'); }
  };
  const del = async () => { if (!confirm('Delete this draft permanently?')) return; await api(`/manage/events/${e.id}`, { method: 'DELETE' }); toast('Draft deleted'); nav(`/manage/${clubId}/events`); };
  const regs = e.registrations.filter((r) => r.status === 'registered');
  const marked = regs.filter((r) => r.attendance).length;
  const vols = e.tasks.reduce((a, t) => a + t.signups.length, 0);
  return (
    <>
      <Link to={`/manage/${clubId}/events`} className="row small muted mb-16" style={{ gap: 6 }}><ArrowLeft size={15} />All events</Link>
      <div className="card card-pad mb-24">
        <div className="row wrap between" style={{ alignItems: 'flex-start' }}>
          <div className="grow" style={{ minWidth: 260 }}>
            <div className="row wrap" style={{ gap: 6 }}><span className={`badge ${REG_STATE[e.reg_state][1]}`}>{REG_STATE[e.reg_state][0]}</span><span className="badge club">{e.category}</span>{e.status !== 'draft' && <ApprovalBadge e={e} />}</div>
            <h1 style={{ fontSize: 26, marginTop: 10 }}>{e.title}</h1>
            <p className="muted small mt-8" style={{ marginTop: 4 }}>{fmtDT(e.start_at)} – {fmtTime(e.end_at)} · {e.venue}</p>
          </div>
          <div className="row wrap">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Pencil size={14} />Edit</button>
            {e.status === 'draft' && <><button className="btn btn-brand btn-sm" onClick={() => status('published')}><Send size={14} />Publish</button><button className="btn btn-danger btn-sm" onClick={del}><Trash2 size={14} />Delete</button></>}
            {e.status === 'published' && e.reg_state !== 'ended' && <button className="btn btn-danger btn-sm" onClick={() => status('cancelled')}><Ban size={14} />Cancel event</button>}
            {e.status === 'cancelled' && <button className="btn btn-ghost btn-sm" onClick={() => status('published')}><Undo2 size={14} />Restore</button>}
            {e.status !== 'draft' && <Link to={`/events/${e.id}`} className="btn btn-ghost btn-sm"><ExternalLink size={14} />Public page</Link>}
          </div>
        </div>
      </div>
      <div className="grid g-4 mb-24">
        <Stat icon={Users} label={`Registered of ${e.capacity}${e.waitlisted ? ` · ${e.waitlisted} waitlisted` : ''}`} value={e.registered} />
        <Stat icon={UserCheck} label={`Present · ${marked}/${regs.length} marked`} value={e.present} color="#059669" />
        <Stat icon={HandHeart} label="Volunteers" value={vols} color="#db2777" />
        <Stat icon={Award} label="Certificates" value={e.certificates.filter((c) => !c.revoked).length} color="#d97706" />
      </div>
      <div className="tabs">
        {[['attendance', 'Registrations & attendance', e.registrations.length], ['checkin', 'Check-in desk'], ['volunteers', 'Volunteers', vols], ['certificates', 'Certificates', e.certificates.length]].map(([k, l, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}{n != null && <span className="count">{n}</span>}</button>)}
      </div>
      {tab === 'attendance' && <Attendance e={e} setData={setData} reload={reload} />}
      {tab === 'checkin' && <CheckIn e={e} reload={reload} />}
      {tab === 'volunteers' && <Volunteers e={e} reload={reload} />}
      {tab === 'certificates' && <Certificates e={e} reload={reload} />}
      {editing && <EventForm clubId={clubId} event={e} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />}
    </>
  );
}

function Attendance({ e, setData, reload }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [f, setF] = useState('all');
  const list = e.registrations.filter((r) => (!q || `${r.name} ${r.usn} ${r.email}`.toLowerCase().includes(q.toLowerCase()))
    && (f === 'all' || (f === 'waitlisted' ? r.status === 'waitlisted' : f === 'unmarked' ? r.status === 'registered' && !r.attendance : r.attendance === f)));
  const mark = async (updates) => {
    setData((d) => ({ ...d, registrations: d.registrations.map((r) => { const u = updates.find((x) => x.id === r.id); return u ? { ...r, attendance: u.attendance } : r; }) }));
    try { await api(`/manage/events/${e.id}/attendance`, { method: 'POST', body: { updates } }); } catch (x) { toast(x.message, 'bad'); }
    reload();
  };
  const started = new Date(e.start_at) <= new Date(Date.now() + 2 * 3600000);
  return (
    <div className="card">
      <div className="card-head" style={{ flexWrap: 'wrap' }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="input-icon" style={{ width: 260, maxWidth: '100%' }}><Search size={17} /><input className="input" style={{ height: 38 }} placeholder="Search name, USN" value={q} onChange={(x) => setQ(x.target.value)} /></div>
          <div className="seg">{[['all', 'All'], ['unmarked', 'Unmarked'], ['present', 'Present'], ['absent', 'Absent'], ['waitlisted', 'Waitlist']].map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {started && <button className="btn btn-ghost btn-sm" onClick={() => mark(e.registrations.filter((r) => r.status === 'registered' && !r.attendance).map((r) => ({ id: r.id, attendance: 'absent' })))}>Mark unmarked absent</button>}
          <a className="btn btn-primary btn-sm" href={fileUrl(`/manage/events/${e.id}/attendance.csv`)}><Download size={15} />CSV</a>
        </div>
      </div>
      {!started && <div className="notice" style={{ margin: 16 }}><AlertCircle size={18} /><div>Attendance can be marked any time, but is usually recorded on the event day. Use the <b>Check-in desk</b> tab to scan QR tickets.</div></div>}
      {list.length === 0 ? <Empty title="No participants match" /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Participant</th><th>Branch / Year</th><th>Registered</th><th>Status</th><th>Attendance</th></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.id}>
              <td><div className="person"><Avatar name={r.name} size="sm" /><div><b>{r.name}</b><span className="mono">{r.usn}</span></div></div></td>
              <td className="small">{r.branch} · Y{r.year}</td>
              <td className="small muted nowrap">{relTime(r.created_at)}</td>
              <td>{r.status === 'waitlisted' ? <span className="badge warn">Waitlisted</span> : <span className="badge ok">Confirmed</span>}</td>
              <td>{r.status === 'registered' ? (
                <div className="att-toggle">
                  <button className={`p ${r.attendance === 'present' ? 'on' : ''}`} onClick={() => mark([{ id: r.id, attendance: r.attendance === 'present' ? null : 'present' }])}><Check size={14} />Present</button>
                  <button className={`a ${r.attendance === 'absent' ? 'on' : ''}`} onClick={() => mark([{ id: r.id, attendance: r.attendance === 'absent' ? null : 'absent' }])}><X size={14} />Absent</button>
                </div>
              ) : <span className="xs muted">—</span>}{r.checked_in_at && r.attendance === 'present' && <div className="xs muted" style={{ marginTop: 3 }}>in at {fmtTime(r.checked_in_at)}</div>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

function CheckIn({ e, reload }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [cam, setCam] = useState(false);
  const [camErr, setCamErr] = useState('');
  const [log, setLog] = useState([]);
  const scanner = useRef(null);
  const last = useRef({ t: 0, v: '' });
  const submit = async (val) => {
    const v = String(val || '').trim(); if (!v) return;
    try {
      const r = await api(`/manage/events/${e.id}/checkin`, { method: 'POST', body: { code: v } });
      setResult({ ok: true, already: r.already, r: r.registration });
      setLog((l) => [{ ...r.registration, already: r.already, at: new Date() }, ...l].slice(0, 12));
      reload();
    } catch (x) { setResult({ ok: false, msg: x.message }); }
    setCode('');
  };
  const startCam = async () => {
    setCamErr('');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const s = new Html5Qrcode('qr-reader');
      scanner.current = s;
      setCam(true);
      await s.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, (text) => {
        const now = Date.now();
        if (text === last.current.v && now - last.current.t < 3000) return;
        last.current = { t: now, v: text }; submit(text);
      });
    } catch (x) { setCam(false); setCamErr(String(x?.message || x).includes('ermission') ? 'Camera permission was denied.' : 'No camera available on this device — use the manual entry instead.'); }
  };
  const stopCam = async () => { try { await scanner.current?.stop(); } catch {} setCam(false); };
  useEffect(() => () => { scanner.current?.stop?.().catch(() => {}); }, []);
  const present = e.registrations.filter((r) => r.attendance === 'present').length;
  return (
    <div className="grid g-2">
      <div className="card card-pad">
        <div className="row between mb-16"><h3 className="row"><QrCode size={18} />Scan tickets</h3>{cam ? <button className="btn btn-ghost btn-sm" onClick={stopCam}><CameraOff size={15} />Stop camera</button> : <button className="btn btn-brand btn-sm" onClick={startCam}><Camera size={15} />Start camera</button>}</div>
        <div className="scanner-box" style={{ display: 'grid', placeItems: 'center' }}>
          <div id="qr-reader" style={{ width: '100%' }} />
          {!cam && <div className="center" style={{ color: '#94a3b8', padding: 30, position: 'absolute' }}><QrCode size={48} /><p className="small mt-8">Point the camera at a participant's ticket QR</p></div>}
        </div>
        {camErr && <div className="notice warn mt-16"><AlertCircle size={18} /><div>{camErr}</div></div>}
        <form className="row mt-16" onSubmit={(x) => { x.preventDefault(); submit(code); }}>
          <input className="input mono" value={code} onChange={(x) => setCode(x.target.value)} placeholder="Ticket code or USN" aria-label="Ticket code or USN" />
          <button className="btn btn-primary">Check in</button>
        </form>
        {result && (
          <div className="scan-result mt-16" style={{ background: result.ok ? (result.already ? 'var(--warn-soft)' : 'var(--ok-soft)') : 'var(--bad-soft)' }}>
            {result.ok ? <CheckCircle2 size={28} color={result.already ? 'var(--warn)' : 'var(--ok)'} /> : <AlertCircle size={28} color="var(--bad)" />}
            <div>{result.ok ? <><b>{result.r.name}</b><div className="small">{result.r.usn} · {result.already ? 'Already checked in' : 'Checked in ✓'}</div></> : <b className="small">{result.msg}</b>}</div>
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-head"><h3>Live check-ins</h3><span className="badge ok">{present} / {e.registered} in</span></div>
        <div style={{ padding: '14px 20px' }}><div className="bar ok"><i style={{ width: `${(100 * present) / Math.max(1, e.registered)}%` }} /></div></div>
        {log.length === 0 ? <p className="muted small" style={{ padding: '0 20px 20px' }}>Scans from this session will appear here.</p> : log.map((r, i) => (
          <div key={i} className="list-row"><Avatar name={r.name} size="sm" /><div className="grow"><b className="small">{r.name}</b><div className="xs muted mono">{r.usn}</div></div><span className={`badge ${r.already ? 'warn' : 'ok'}`}>{r.already ? 'Repeat' : 'In'}</span><span className="xs muted">{fmtTime(r.at)}</span></div>
        ))}
      </div>
    </div>
  );
}

function Volunteers({ e, reload }) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [assign, setAssign] = useState(null);
  const run = async (fn, msg) => { try { await fn(); msg && toast(msg); reload(); } catch (x) { toast(x.message, 'bad'); } };
  const setSignup = (s, status, hours) => run(() => api(`/manage/signups/${s.id}`, { method: 'PUT', body: { status, hours } }), { completed: 'Marked completed', no_show: 'Marked no-show', assigned: 'Volunteer confirmed', cancelled: 'Removed' }[status]);
  return (
    <>
      <div className="row between mb-16"><p className="muted small">Create volunteer roles, confirm sign-ups and log hours. Completed volunteers can receive certificates.</p><button className="btn btn-brand btn-sm" onClick={() => setAdding(true)}><Plus size={15} />Add task</button></div>
      {e.tasks.length === 0 ? <div className="card"><Empty icon={ClipboardList} title="No volunteer tasks yet" action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} />Add first task</button>}>Add roles such as registration desk, logistics or photography.</Empty></div> : (
        <div className="col" style={{ gap: 16 }}>
          {e.tasks.map((t) => (
            <div key={t.id} className="card">
              <div className="card-head">
                <div><h3>{t.role}</h3><div className="xs muted">{fmtTime(t.slot_start)} – {fmtTime(t.slot_end)} · {t.hours} hrs · {t.signups.length}/{t.needed} filled</div></div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setAssign(t)}><Plus size={14} />Assign</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => confirm('Delete this task and its sign-ups?') && run(() => api(`/manage/tasks/${t.id}`, { method: 'DELETE' }), 'Task deleted')} aria-label="Delete task"><Trash2 size={14} /></button>
                </div>
              </div>
              {t.description && <p className="small muted" style={{ padding: '12px 20px 0' }}>{t.description}</p>}
              {t.signups.length === 0 ? <p className="small muted" style={{ padding: 20 }}>No sign-ups yet.</p> : t.signups.map((s) => (
                <div key={s.id} className="list-row">
                  <Avatar name={s.name} size="sm" />
                  <div className="grow"><b className="small">{s.name}</b><div className="xs muted">{s.usn} · {s.email}</div></div>
                  <span className={`badge ${{ signed_up: 'brand', assigned: 'info', completed: 'ok', no_show: 'bad' }[s.status]}`}>{{ signed_up: 'Signed up', assigned: 'Confirmed', completed: `Completed · ${s.hours}h`, no_show: 'No-show' }[s.status]}</span>
                  <div className="row" style={{ gap: 4 }}>
                    {s.status === 'signed_up' && <button className="btn btn-ghost btn-sm" onClick={() => setSignup(s, 'assigned')}>Confirm</button>}
                    {s.status !== 'completed' && <button className="btn btn-soft btn-sm" onClick={() => setSignup(s, 'completed', t.hours)}><Check size={14} />Done</button>}
                    {s.status === 'completed' && <input type="number" step="0.5" min="0" className="input" style={{ width: 70, height: 32 }} defaultValue={s.hours} onBlur={(x) => Number(x.target.value) !== s.hours && setSignup(s, 'completed', Number(x.target.value))} aria-label="Hours" title="Hours" />}
                    {s.status !== 'no_show' && s.status !== 'completed' && <button className="btn btn-ghost btn-sm" onClick={() => setSignup(s, 'no_show')}>No-show</button>}
                    <button className="btn btn-ghost btn-sm" onClick={() => setSignup(s, 'cancelled')} aria-label="Remove"><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {adding && <TaskModal e={e} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} />}
      {assign && (
        <Modal title={`Assign to ${assign.role}`} sub="Club members are listed. They will be notified." onClose={() => setAssign(null)}>
          <div className="col" style={{ gap: 4, maxHeight: 400, overflowY: 'auto' }}>
            {e.members.filter((m) => !assign.signups.some((s) => s.user_id === m.id)).map((m) => (
              <button key={m.id} className="btn btn-ghost" style={{ justifyContent: 'flex-start', height: 48 }} onClick={() => { run(() => api(`/manage/tasks/${assign.id}/assign`, { method: 'POST', body: { user_id: m.id } }), `${m.name} assigned`); setAssign(null); }}>
                <Avatar name={m.name} size="sm" /><span className="grow" style={{ textAlign: 'left' }}>{m.name}</span><span className="xs muted mono">{m.usn}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

function TaskModal({ e, onClose, onSaved }) {
  const [f, setF] = useState({ role: '', description: '', slot_start: toLocalInput(e.start_at), slot_end: toLocalInput(e.end_at), needed: 3, hours: Math.max(1, Math.round((new Date(e.end_at) - new Date(e.start_at)) / 3600000)) });
  const [err, setErr] = useState('');
  const set = (k) => (x) => setF({ ...f, [k]: x.target.value });
  const save = async () => { try { await api(`/manage/events/${e.id}/tasks`, { method: 'POST', body: { ...f, slot_start: new Date(f.slot_start).toISOString(), slot_end: new Date(f.slot_end).toISOString() } }); onSaved(); } catch (x) { setErr(x.message); } };
  return (
    <Modal title="New volunteer task" onClose={onClose} foot={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-brand" onClick={save}>Create task</button></>}>
      <div className="form-grid">
        <label className="field full"><span>Role</span><input className="input" value={f.role} onChange={set('role')} placeholder="e.g. Registration Desk" list="roles" /><datalist id="roles">{['Registration Desk', 'Stage & Logistics', 'Photography', 'Tech Support', 'Hospitality', 'Social Media', 'Crowd Management'].map((r) => <option key={r} value={r} />)}</datalist></label>
        <label className="field full"><span>Description</span><textarea className="textarea" style={{ minHeight: 70 }} value={f.description} onChange={set('description')} /></label>
        <label className="field"><span>Slot start</span><input type="datetime-local" className="input" value={f.slot_start} onChange={set('slot_start')} /></label>
        <label className="field"><span>Slot end</span><input type="datetime-local" className="input" value={f.slot_end} onChange={set('slot_end')} /></label>
        <label className="field"><span>Volunteers needed</span><input type="number" min="1" className="input" value={f.needed} onChange={set('needed')} /></label>
        <label className="field"><span>Hours credited</span><input type="number" min="0.5" step="0.5" className="input" value={f.hours} onChange={set('hours')} /></label>
        {err && <div className="error-box full">{err}</div>}
      </div>
    </Modal>
  );
}

function Certificates({ e, reload }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const has = (uid, type) => e.certificates.some((c) => c.user_id === uid && c.type === type);
  const eligibleP = e.registrations.filter((r) => r.attendance === 'present' && !has(r.user_id, 'participation')).length;
  const done = new Set(); e.tasks.forEach((t) => t.signups.forEach((s) => s.status === 'completed' && !has(s.user_id, 'volunteer') && done.add(s.user_id)));
  const eligibleV = done.size;
  const started = new Date(e.start_at) <= new Date();
  const gen = async (types) => { setBusy(true); try { const r = await api(`/manage/events/${e.id}/certificates`, { method: 'POST', body: { types } }); toast(`${r.created} certificate${r.created === 1 ? '' : 's'} issued`); reload(); } catch (x) { toast(x.message, 'bad'); } setBusy(false); };
  const revoke = async (c) => { await api(`/manage/certificates/${c.code}/revoke`, { method: 'POST', body: { revoke: !c.revoked } }); toast(c.revoked ? 'Certificate restored' : 'Certificate revoked'); reload(); };
  return (
    <>
      <div className="grid g-2 mb-24">
        <div className="card card-pad"><h3>Participation certificates</h3><p className="small muted mt-8">Issued to everyone marked <b>present</b>.</p><div className="row between mt-16"><span><b style={{ font: '800 26px/1 var(--head)' }}>{eligibleP}</b> <span className="muted small">pending</span></span><button className="btn btn-brand" disabled={busy || !started || !eligibleP} onClick={() => gen(['participation'])}><Award size={16} />Generate</button></div></div>
        <div className="card card-pad"><h3>Volunteer certificates</h3><p className="small muted mt-8">Issued to volunteers marked <b>completed</b>, with hours.</p><div className="row between mt-16"><span><b style={{ font: '800 26px/1 var(--head)' }}>{eligibleV}</b> <span className="muted small">pending</span></span><button className="btn btn-brand" disabled={busy || !started || !eligibleV} onClick={() => gen(['volunteer'])}><Award size={16} />Generate</button></div></div>
      </div>
      {!started && <div className="notice mb-16"><AlertCircle size={18} /><div>Certificates can be generated once the event has started and attendance is recorded.</div></div>}
      <div className="card">
        <div className="card-head"><h3>Issued certificates</h3><span className="xs muted">Each has a unique ID verifiable at /verify</span></div>
        {e.certificates.length === 0 ? <p className="muted small" style={{ padding: 20 }}>None issued yet.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Recipient</th><th>Type</th><th>Certificate ID</th><th>Issued</th><th /></tr></thead>
            <tbody>{e.certificates.map((c) => (
              <tr key={c.code} style={{ opacity: c.revoked ? 0.5 : 1 }}>
                <td><b className="small">{c.name}</b></td>
                <td><span className={`badge ${c.type === 'volunteer' ? 'club' : 'warn'}`}>{c.type}{c.hours ? ` · ${c.hours}h` : ''}</span></td>
                <td className="mono small">{c.code}</td>
                <td className="small muted">{relTime(c.issued_at)}</td>
                <td className="nowrap"><a className="btn btn-ghost btn-sm" href={fileUrl(`/certificates/${c.code}/pdf`, '&inline=1')} target="_blank" rel="noreferrer">PDF</a> <button className="btn btn-ghost btn-sm" onClick={() => revoke(c)}>{c.revoked ? 'Restore' : 'Revoke'}</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
