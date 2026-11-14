import { useState } from 'react';
import { Plus, Check, X, Trash2, ClipboardCheck } from 'lucide-react';
import { api } from '../../api.js';
import { Avatar, Empty, fmtDT, Modal, Spinner, toLocalInput, useAsync, useToast } from '../../ui.jsx';
import { ConsoleHead } from './Manage.jsx';

export default function Meetings({ clubId }) {
  const toast = useToast();
  const list = useAsync(() => api(`/manage/${clubId}/meetings`), [clubId]);
  const st = useAsync(() => api(`/manage/${clubId}/structure`), [clubId]);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(null);
  if (!list.data || !st.data) return <Spinner />;
  return (
    <>
      <ConsoleHead title="Club attendance" sub="Track general body meetings, weekly syncs and division sessions. Members see their own attendance in My Space.">
        <button className="btn btn-brand" onClick={() => setCreating(true)}><Plus size={16} />New meeting</button>
      </ConsoleHead>
      <div className="card">
        {list.data.length === 0 ? <Empty icon={ClipboardCheck} title="No meetings recorded" action={<button className="btn btn-primary" onClick={() => setCreating(true)}>Record first meeting</button>} /> : list.data.map((m) => {
          const pct = m.marked ? Math.round((100 * m.present) / m.marked) : null;
          return (
            <div key={m.id} className="list-row" style={{ cursor: 'pointer' }} onClick={() => setOpen(m.id)}>
              <div className="club-logo sm"><ClipboardCheck size={16} /></div>
              <div className="grow"><b>{m.title}</b><div className="xs muted">{fmtDT(m.date)} · {m.division_name || 'Whole club'}</div></div>
              {pct == null ? <span className="badge warn">Not marked</span> : <span className={`badge ${pct >= 75 ? 'ok' : pct >= 50 ? 'warn' : 'bad'}`}>{m.present}/{m.marked} · {pct}%</span>}
            </div>
          );
        })}
      </div>
      {creating && <NewMeeting clubId={clubId} divisions={st.data.divisions} onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); list.reload(); setOpen(id); toast('Meeting created — mark attendance'); }} />}
      {open && <MarkMeeting id={open} onClose={() => { setOpen(null); list.reload(); }} />}
    </>
  );
}

function NewMeeting({ clubId, divisions, onClose, onSaved }) {
  const [f, setF] = useState({ title: 'Weekly Sync', date: toLocalInput(new Date()), division_id: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => { try { const r = await api(`/manage/${clubId}/meetings`, { method: 'POST', body: { ...f, date: new Date(f.date).toISOString() } }); onSaved(r.id); } catch (e) { setErr(e.message); } };
  return (
    <Modal title="New meeting" onClose={onClose} foot={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-brand" onClick={save}>Create</button></>}>
      <div className="col" style={{ gap: 14 }}>
        <label className="field"><span>Title</span><input className="input" value={f.title} onChange={set('title')} /></label>
        <label className="field"><span>Date & time</span><input type="datetime-local" className="input" value={f.date} onChange={set('date')} /></label>
        <label className="field"><span>For</span><select className="select" value={f.division_id} onChange={set('division_id')}><option value="">Whole club</option>{divisions.map((d) => <option key={d.id} value={d.id}>{d.name} division</option>)}</select></label>
        {err && <div className="error-box">{err}</div>}
      </div>
    </Modal>
  );
}

function MarkMeeting({ id, onClose }) {
  const toast = useToast();
  const { data, setData } = useAsync(() => api(`/manage/meetings/${id}`), [id]);
  const save = async (updates) => {
    setData((d) => ({ ...d, members: d.members.map((m) => { const u = updates.find((x) => x.user_id === m.user_id); return u ? { ...m, status: u.status } : m; }) }));
    await api(`/manage/meetings/${id}/attendance`, { method: 'POST', body: { updates } });
  };
  const del = async () => { if (!confirm('Delete this meeting?')) return; await api(`/manage/meetings/${id}`, { method: 'DELETE' }); toast('Meeting deleted'); onClose(); };
  if (!data) return <Modal title="Loading…" onClose={onClose}><Spinner /></Modal>;
  const p = data.members.filter((m) => m.status === 'present').length;
  return (
    <Modal wide title={data.meeting.title} sub={`${fmtDT(data.meeting.date)} · ${p}/${data.members.length} present`} onClose={onClose}
      foot={<><button className="btn btn-danger" onClick={del}><Trash2 size={15} />Delete</button><span className="grow" /><button className="btn btn-ghost" onClick={() => save(data.members.map((m) => ({ user_id: m.user_id, status: 'present' })))}>Mark all present</button><button className="btn btn-primary" onClick={onClose}>Done</button></>}>
      <div className="col" style={{ gap: 0 }}>
        {data.members.map((m) => (
          <div key={m.user_id} className="row" style={{ padding: '9px 0', borderBottom: '1px solid var(--line-2)' }}>
            <Avatar name={m.name} size="sm" />
            <div className="grow"><b className="small">{m.name}</b><div className="xs muted">{m.usn}{m.division_name ? ` · ${m.division_name}` : ''}</div></div>
            <div className="att-toggle">
              <button className={`p ${m.status === 'present' ? 'on' : ''}`} onClick={() => save([{ user_id: m.user_id, status: m.status === 'present' ? null : 'present' }])}><Check size={14} />P</button>
              <button className={`a ${m.status === 'absent' ? 'on' : ''}`} onClick={() => save([{ user_id: m.user_id, status: m.status === 'absent' ? null : 'absent' }])}><X size={14} />A</button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
