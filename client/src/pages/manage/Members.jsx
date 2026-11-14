import { useState } from 'react';
import { Search, UserMinus, Download, ArrowRight, Check, X, CalendarClock } from 'lucide-react';
import { api, fileUrl } from '../../api.js';
import { Avatar, BRANCHES, Empty, fmtDate, fmtDT, Modal, Spinner, Stepper, toLocalInput, useAsync, useToast, yearLabel } from '../../ui.jsx';
import { ConsoleHead } from './Manage.jsx';

export default function Members({ clubId }) {
  const toast = useToast();
  const m = useAsync(() => api(`/manage/${clubId}/members`), [clubId]);
  const st = useAsync(() => api(`/manage/${clubId}/structure`), [clubId]);
  const [tab, setTab] = useState('applications');
  const [q, setQ] = useState('');
  const [div, setDiv] = useState('');
  const [open, setOpen] = useState(null);
  if (!m.data || !st.data) return <Spinner />;
  const { roles, divisions, stages } = st.data;
  const all = m.data.members;
  const members = all.filter((x) => x.status === 'approved');
  const apps = all.filter((x) => x.status === 'pending');
  const rejected = all.filter((x) => x.status === 'rejected');
  const match = (x) => (!q || `${x.name} ${x.usn} ${x.email}`.toLowerCase().includes(q.toLowerCase())) && (!div || String(x.division_id) === div);
  const update = async (mid, body, msg) => { try { await api(`/manage/${clubId}/members/${mid}`, { method: 'PUT', body }); msg && toast(msg); m.reload(); } catch (e) { toast(e.message, 'bad'); } };

  return (
    <>
      <ConsoleHead title="Members & recruitment" sub={`Pipeline: ${stages.join(' → ')}`}>
        <a className="btn btn-ghost btn-sm" href={fileUrl(`/manage/${clubId}/report/members.csv`)}><Download size={15} />Export members</a>
      </ConsoleHead>
      <div className="tabs">
        {[['applications', 'Applications', apps.length], ['members', 'Members', members.length], ['rejected', 'Not selected', rejected.length]].map(([k, l, n]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}<span className="count">{n}</span></button>)}
      </div>

      {tab === 'applications' && (apps.length === 0 ? <Empty title="No open applications">New applications from students will appear here.</Empty> : (
        <div className="kanban">
          {stages.slice(0, -1).map((s, i) => {
            const col = apps.filter((a) => a.stage === i);
            return (
              <div key={s} className="kcol">
                <h4>{s}<span className="badge">{col.length}</span></h4>
                {col.map((a) => (
                  <div key={a.id} className="kcard" onClick={() => setOpen(a)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(a)}>
                    <div className="person"><Avatar name={a.name} size="sm" /><div className="grow"><b>{a.name}</b><span>{a.usn} · {yearLabel(a.year)}</span></div></div>
                    <div className="row wrap mt-8" style={{ gap: 6 }}>{a.division_name && <span className="badge club">{a.division_name}</span>}{a.score && <span className="badge">Score {a.score}</span>}</div>
                    {a.stage_date && <div className="xs muted mt-8 row" style={{ gap: 5 }}><CalendarClock size={13} />{fmtDT(a.stage_date)}</div>}
                  </div>
                ))}
                {!col.length && <p className="xs muted center" style={{ padding: 16 }}>Empty</p>}
              </div>
            );
          })}
          <div className="kcol" style={{ background: 'var(--ok-soft)', borderColor: '#bfe9d6' }}><h4>{stages[stages.length - 1]}<span className="badge ok">{members.length}</span></h4><p className="xs muted">Selected applicants become members automatically.</p></div>
        </div>
      ))}

      {tab === 'members' && (
        <div className="card">
          <div className="card-head" style={{ flexWrap: 'wrap' }}>
            <div className="input-icon" style={{ width: 280, maxWidth: '100%' }}><Search size={17} /><input className="input" style={{ height: 38 }} placeholder="Search name, USN, email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="select" style={{ width: 220, height: 38 }} value={div} onChange={(e) => setDiv(e.target.value)} aria-label="Division filter"><option value="">All divisions</option>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
          </div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Member</th><th>Role</th><th>Division</th><th>Attendance</th><th>Joined</th><th /></tr></thead>
            <tbody>{members.filter(match).map((x) => (
              <tr key={x.id}>
                <td><div className="person"><Avatar name={x.name} size="sm" /><div><b>{x.name}</b><span>{x.usn} · {x.branch} · Y{x.year}</span></div></div></td>
                <td><select className="select" style={{ height: 34, width: 170, fontSize: 13 }} value={x.role_id || ''} onChange={(e) => update(x.id, { action: 'update', role_id: Number(e.target.value), division_id: x.division_id }, 'Role updated')}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></td>
                <td><select className="select" style={{ height: 34, width: 170, fontSize: 13 }} value={x.division_id || ''} onChange={(e) => update(x.id, { action: 'update', division_id: e.target.value ? Number(e.target.value) : null }, 'Division updated')}><option value="">—</option>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></td>
                <td>{x.att == null ? <span className="muted xs">—</span> : <span className={`badge ${x.att >= 75 ? 'ok' : x.att >= 60 ? 'warn' : 'bad'}`}>{x.att}%</span>}</td>
                <td className="small muted nowrap">{x.joined_at ? fmtDate(x.joined_at) : '—'}</td>
                <td><button className="btn btn-ghost btn-sm" title="Remove from club" onClick={() => confirm(`Remove ${x.name} from the club?`) && update(x.id, { action: 'remove' }, 'Member removed')}><UserMinus size={15} /></button></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}

      {tab === 'rejected' && (
        <div className="card">{rejected.length ? rejected.map((x) => (
          <div key={x.id} className="list-row"><Avatar name={x.name} size="sm" /><div className="grow"><b>{x.name}</b><div className="xs muted">{x.usn} · {x.note || 'No note'}</div></div><button className="btn btn-ghost btn-sm" onClick={() => update(x.id, { action: 'approve' }, `${x.name} approved`)}>Approve anyway</button></div>
        )) : <p className="muted small" style={{ padding: 20 }}>Nobody here.</p>}</div>
      )}

      {open && <ApplicantModal a={open} stages={stages} roles={roles} divisions={divisions} onClose={() => setOpen(null)} onAction={async (body, msg) => { await update(open.id, body, msg); setOpen(null); }} />}
    </>
  );
}

function ApplicantModal({ a, stages, roles, divisions, onClose, onAction }) {
  const next = a.stage + 1;
  const final = next >= stages.length - 1;
  const [f, setF] = useState({ score: a.score || '', note: '', stage_date: '', role_id: '', division_id: a.division_id || '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal wide title={a.name} sub={`${a.usn} · ${BRANCHES[a.branch] || a.branch} · ${yearLabel(a.year)} · ${a.email}`} onClose={onClose}
      foot={<>
        <button className="btn btn-danger" onClick={() => onAction({ action: 'reject', note: f.note }, `${a.name} marked not selected`)}><X size={16} />Reject</button>
        <span className="grow" />
        {!final && <button className="btn btn-ghost" onClick={() => onAction({ action: 'approve', role_id: f.role_id || null, division_id: f.division_id || null }, `${a.name} is now a member`)}>Select directly</button>}
        <button className="btn btn-brand" onClick={() => onAction(final ? { action: 'approve', role_id: f.role_id || null, division_id: f.division_id || null } : { action: 'advance', score: f.score, note: f.note, stage_date: f.stage_date ? new Date(f.stage_date).toISOString() : null }, final ? `${a.name} selected 🎉` : `Moved to ${stages[next]}`)}>
          {final ? <><Check size={16} />Select as member</> : <>Move to {stages[next]} <ArrowRight size={16} /></>}
        </button>
      </>}>
      <Stepper stages={stages} current={a.stage} />
      <div className="grid g-2 mt-24" style={{ gap: 16 }}>
        <div>
          <p className="xs muted bold">STATEMENT</p>
          <p className="small ink2 mt-8" style={{ whiteSpace: 'pre-line' }}>{a.statement || 'No statement provided.'}</p>
          <p className="xs muted mt-16">Applied {fmtDate(a.applied_at)}{a.division_name && <> · prefers <b>{a.division_name}</b></>}</p>
          {a.note && <div className="notice mt-16"><div><b>Current note:</b> {a.note}</div></div>}
        </div>
        <div className="col" style={{ gap: 12 }}>
          <label className="field"><span>Score / remarks for {stages[a.stage]}</span><input className="input" value={f.score} onChange={set('score')} placeholder="e.g. 78/100" /></label>
          {!final ? (
            <>
              <label className="field"><span>Schedule {stages[next]}</span><input type="datetime-local" className="input" value={f.stage_date} min={toLocalInput(new Date())} onChange={set('stage_date')} /></label>
              <label className="field"><span>Message to applicant</span><textarea className="textarea" style={{ minHeight: 70 }} value={f.note} onChange={set('note')} placeholder="Venue, what to bring, syllabus…" /></label>
            </>
          ) : (
            <>
              <label className="field"><span>Role</span><select className="select" value={f.role_id} onChange={set('role_id')}><option value="">Default (Member)</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
              <label className="field"><span>Note (shown if rejected)</span><input className="input" value={f.note} onChange={set('note')} /></label>
            </>
          )}
          {final && <label className="field"><span>Division</span><select className="select" value={f.division_id} onChange={set('division_id')}><option value="">—</option>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
        </div>
      </div>
    </Modal>
  );
}
